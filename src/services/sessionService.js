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
    let session = await Session.findOne({ sessionId });

    if (!session) {
        session = new Session({
            sessionId,
            platform,
            sender,
            status: "active",
            engagementPhase: "early"
        });
        await session.save();
    } else {
        // Update last active time
        session.lastActiveAt = new Date();
        await session.save();
    }

    return session;
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
    const turns = await ConversationTurn.find({ sessionId })
        .sort({ turnIndex: 1 });

    return turns;
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
    // Get current turn count
    const existingTurns = await ConversationTurn.countDocuments({ sessionId });

    const turn = new ConversationTurn({
        sessionId,
        turnIndex: existingTurns,
        role,
        text,
        detectedScamIntent: scamIntent,
        extractedIntel: {
            upiIds: intel.upiIds || [],
            phoneNumbers: intel.phoneNumbers || [],
            urls: intel.urls || [],
            scamPhrases: intel.scamPhrases || [],
            behavioralPatterns: intel.behavioralPatterns || []
        }
    });

    await turn.save();
    return turn;
}

/**
 * Determine engagement phase based on conversation history
 * @param {string} sessionId - Session identifier
 * @returns {string} - Engagement phase: 'early', 'mid', 'late', or 'final'
 */
async function determineEngagementPhase(sessionId) {
    const turnCount = await ConversationTurn.countDocuments({ sessionId });

    if (turnCount <= 2) return "early";
    if (turnCount <= 5) return "mid";
    if (turnCount <= 8) return "late";
    return "final";
}

/**
 * Get all extracted intelligence for a session
 * @param {string} sessionId - Session identifier
 * @returns {Object} - Aggregated intelligence
 */
async function getSessionIntelligence(sessionId) {
    const turns = await ConversationTurn.find({ sessionId });

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
        upiIds: Array.from(aggregatedIntel.upiIds),
        phoneNumbers: Array.from(aggregatedIntel.phoneNumbers),
        urls: Array.from(aggregatedIntel.urls),
        scamPhrases: Array.from(aggregatedIntel.scamPhrases),
        behavioralPatterns: Array.from(aggregatedIntel.behavioralPatterns)
    };
}

module.exports = {
    getOrCreateSession,
    updateSession,
    getConversationHistory,
    saveConversationTurn,
    determineEngagementPhase,
    getSessionIntelligence
};
