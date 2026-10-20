// src/services/sessionService.js
const Session = require("../models/Session");
const ConversationTurn = require("../models/ConversationTurn");

/**
 * Create or get existing session
 * @param {string} sessionId - Unique session identifier
 * @param {string} platform - Platform name (e.g., 'whatsapp', 'telegram')
 * @param {string} sender - Sender identifier
 * @returns {Object} - Session object
 */
async function getOrCreateSession(sessionId, platform = "unknown", sender = "unknown") {
    // Atomic upsert: concurrent first messages for the same id can no longer race into a duplicate-key error
    const attempt = () => Session.findOneAndUpdate(
        { sessionId },
        {
            $set: { lastActiveAt: new Date() },
            $setOnInsert: { sessionId, platform, sender, status: "active", engagementPhase: "early", createdAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    try {
        return await attempt();
    } catch (err) {
        if (err && err.code === 11000) return attempt();   // lost the insert race — the document exists now
        throw err;
    }
}

/**
 * Update session status
 * @param {string} sessionId - Session identifier
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated session
 */
async function updateSession(sessionId, updates) {
    const session = await Session.findOne({ sessionId });

    if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
    }

    Object.assign(session, updates);
    session.lastActiveAt = new Date();

    await session.save();
    return session;
}

/**
 * Get conversation history for a session
 * @param {string} sessionId - Session identifier
 * @returns {Array} - Array of conversation turns
 */
async function getConversationHistory(sessionId) {
    // Query only the recent context window at the database layer. Fetching every
    // historical turn and slicing in the controller still makes old sessions
    // progressively more expensive to process.
    const turns = await ConversationTurn.find({ sessionId })
        .sort({ turnIndex: -1, _id: -1 })
        .limit(30)
        .lean();

    return turns.reverse();
}

/**
 * Save conversation turn
 * @param {string} sessionId - Session identifier
 * @param {string} role - 'user' or 'agent'
 * @param {string} text - Message text
 * @param {Object} intel - Extracted intelligence (optional)
 * @param {boolean} scamIntent - Whether scam intent was detected
 * @returns {Object} - Saved conversation turn
 */
async function saveConversationTurn(sessionId, role, text, intel = {}, scamIntent = false) {
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 200) {
        throw new TypeError("Invalid session identifier");
    }
    if (role !== "user" && role !== "agent") {
        throw new TypeError("Invalid conversation role");
    }
    if (typeof text !== "string" || text.length > 20000) {
        throw new TypeError("Invalid conversation text");
    }
    const cleanIntelValues = (values) => Array.isArray(values)
        ? [...new Set(values
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim().slice(0, 2048)))].slice(0, 100)
        : [];

    // Initialize legacy sessions from their existing turn count exactly once. The
    // conditional update makes concurrent first writers converge on one sequence.
    const session = await Session.findOne({ sessionId }).select("turnSequence").lean();
    if (!session) {
        throw new Error("Session not found");
    }
    if (!Number.isSafeInteger(session.turnSequence) || session.turnSequence < 0) {
        const existingTurns = await ConversationTurn.countDocuments({ sessionId });
        await Session.updateOne(
            { sessionId, turnSequence: { $exists: false } },
            { $set: { turnSequence: existingTurns } }
        );
    }

    // Allocate indexes atomically instead of countDocuments() followed by insert,
    // which gave simultaneous requests the same turnIndex.
    const allocated = await Session.findOneAndUpdate(
        { sessionId },
        { $inc: { turnSequence: 1 } },
        { new: true, projection: { turnSequence: 1 } }
    ).lean();
    if (!allocated || !Number.isSafeInteger(allocated.turnSequence) || allocated.turnSequence < 1) {
        throw new Error("Unable to allocate conversation turn index");
    }

    const turn = new ConversationTurn({
        sessionId,
        turnIndex: allocated.turnSequence - 1,
        role,
        text,
        detectedScamIntent: scamIntent,
        extractedIntel: {
            upiIds: cleanIntelValues(intel.upiIds),
            phoneNumbers: cleanIntelValues(intel.phoneNumbers),
            urls: cleanIntelValues(intel.urls),
            scamPhrases: cleanIntelValues(intel.scamPhrases),
            behavioralPatterns: cleanIntelValues(intel.behavioralPatterns)
        }
    });

    await turn.save();
    return turn;
}

/**
 * Determine engagement phase based on conversation history and session state
 * Ensures monotonicity: early → mid → late → final
 * @param {string} sessionId - Session identifier
 * @returns {string} - Engagement phase: 'early', 'mid', 'late', or 'final'
 */
async function determineEngagementPhase(sessionId) {
    const session = await Session.findOne({ sessionId });
    const turnCount = await ConversationTurn.countDocuments({ sessionId });

    const PHASE_ORDER = { 'early': 0, 'mid': 1, 'late': 2, 'final': 3 };
    const ORDER_TO_PHASE = ['early', 'mid', 'late', 'final'];

    // Phase based on turns
    let turnPhase = "early";
    if (turnCount > 8) turnPhase = "final";
    else if (turnCount > 5) turnPhase = "late";
    else if (turnCount > 2) turnPhase = "mid";

    // Phase from session (risk-based)
    const storedPhase = session?.highestPhase || 'early';

    // Return the higher of the two
    const turnOrder = PHASE_ORDER[turnPhase];
    const storedOrder = PHASE_ORDER[storedPhase];

    return turnOrder > storedOrder ? turnPhase : storedPhase;
}

/**
 * Get all extracted intelligence for a session
 * @param {string} sessionId - Session identifier
 * @returns {Object} - Aggregated intelligence
 */
async function getSessionIntelligence(sessionId) {
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 200) {
        return { upiIds: [], phoneNumbers: [], urls: [], scamPhrases: [], behavioralPatterns: [] };
    }
    // Keep repeated per-turn aggregation bounded for very long-lived sessions.
    // Recent evidence is preferred; the saved turn records remain unchanged.
    const turns = await ConversationTurn.find({ sessionId })
        .select("turnIndex extractedIntel")
        .sort({ turnIndex: -1, _id: -1 })
        .limit(1000)
        .lean();

    const aggregatedIntel = {
        upiIds: new Set(),
        phoneNumbers: new Set(),
        urls: new Set(),
        scamPhrases: new Set(),
        behavioralPatterns: new Set()
    };

    turns.forEach(turn => {
        if (turn.extractedIntel) {
            turn.extractedIntel.upiIds?.forEach(id => aggregatedIntel.upiIds.add(id));
            turn.extractedIntel.phoneNumbers?.forEach(num => aggregatedIntel.phoneNumbers.add(num));
            turn.extractedIntel.urls?.forEach(url => aggregatedIntel.urls.add(url));
            turn.extractedIntel.scamPhrases?.forEach(phrase => aggregatedIntel.scamPhrases.add(phrase));
            turn.extractedIntel.behavioralPatterns?.forEach(pattern => aggregatedIntel.behavioralPatterns.add(pattern));
        }
    });

    return {
        upiIds: Array.from(aggregatedIntel.upiIds).slice(0, 500),
        phoneNumbers: Array.from(aggregatedIntel.phoneNumbers).slice(0, 500),
        urls: Array.from(aggregatedIntel.urls).slice(0, 500),
        scamPhrases: Array.from(aggregatedIntel.scamPhrases).slice(0, 500),
        behavioralPatterns: Array.from(aggregatedIntel.behavioralPatterns).slice(0, 500)
    };
}

/**
 * Update session emotion state
 * @param {string} sessionId - Session ID
 * @param {string} emotion - Detected emotion
 * @param {number} intensity - Emotion intensity (0-1)
 */
async function updateSessionEmotion(sessionId, emotion, intensity = 0) {
    try {
        const session = await Session.findOne({ sessionId });

        if (!session) {
            console.error(`Session ${sessionId} not found for emotion update`);
            return null;
        }

        // Update emotion history (keep last 10)
        const emotionHistory = session.emotionHistory || [];
        emotionHistory.push(emotion);

        // Keep only last 10 emotions
        const trimmedHistory = emotionHistory.slice(-10);

        await Session.updateOne(
            { sessionId },
            {
                $set: {
                    currentEmotion: emotion,
                    emotionHistory: trimmedHistory,
                    emotionIntensity: intensity,
                    lastActiveAt: Date.now()
                }
            }
        );

        return { emotion, intensity, history: trimmedHistory };
    } catch (error) {
        console.error("Error updating session emotion:", error);
        return null;
    }
}

module.exports = {
    getOrCreateSession,
    updateSession,
    getConversationHistory,
    saveConversationTurn,
    determineEngagementPhase,
    getSessionIntelligence,
    updateSessionEmotion
};
