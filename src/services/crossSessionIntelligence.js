// src/services/crossSessionIntelligence.js

const ScammerIntelligence = require('../models/ScammerIntelligence');

/**
 * Cross-Session Intelligence Service
 * Tracks and correlates scammer information across sessions
 */

/**
 * Check if intelligence exists for UPI ID or phone number
 * @param {Array} upiIds - Extracted UPI IDs
 * @param {Array} phoneNumbers - Extracted phone numbers
 * @returns {Object} - Known scammer info or null
 */
async function checkKnownScammer(upiIds = [], phoneNumbers = []) {
    try {
        // Search for any matching UPI ID or phone number
        const query = {
            $or: [
                { upiId: { $in: upiIds } },
                { phoneNumber: { $in: phoneNumbers } }
            ]
        };

        const knownScammer = await ScammerIntelligence.findOne(query)
            .sort({ sessionCount: -1 }); // Get most frequent first

        if (knownScammer) {
            return {
                isKnown: true,
                sessionCount: knownScammer.sessionCount,
                riskLevel: knownScammer.riskLevel,
                scamTypes: knownScammer.scamTypes,
                averageConfidence: knownScammer.averageConfidence,
                isBlacklisted: knownScammer.isBlacklisted,
                firstSeenAt: knownScammer.firstSeenAt,
                lastSeenAt: knownScammer.lastSeenAt
            };
        }

        return { isKnown: false };
    } catch (error) {
        console.error('Known-scammer lookup failed');
        return { isKnown: false };
    }
}

/**
 * Update or create scammer intelligence
 * @param {Object} intelligence - Extracted intelligence
 * @param {string} sessionId - Current session ID
 * @param {Object} scamContext - Detection context
 */
async function updateScammerIntelligence(intelligence, sessionId, scamContext) {
    try {
        const { upiIds = [], phoneNumbers = [] } = intelligence;
        const { confidence = 0, riskLevel = 'MEDIUM', categories = [] } = scamContext;

        // Update each UPI ID
        for (const upiId of upiIds) {
            await upsertScammerIntel(
                { upiId },
                sessionId,
                confidence,
                riskLevel,
                categories
            );
        }

        // Update each phone number
        for (const phoneNumber of phoneNumbers) {
            await upsertScammerIntel(
                { phoneNumber },
                sessionId,
                confidence,
                riskLevel,
                categories
            );
        }
    } catch (error) {
        console.error('Scammer intelligence update failed');
    }
}

/**
 * Upsert scammer intelligence record
 */
async function upsertScammerIntel(identifier, sessionId, confidence, riskLevel, categories) {
    try {
        const existing = await ScammerIntelligence.findOne(identifier);

        if (existing) {
            // Repeated messages from one conversation are not independent sightings.
            // Count each session at most once, otherwise a single long chat can
            // incorrectly satisfy cross-session auto-blacklisting thresholds.
            existing.lastSeenAt = new Date();
            if (!Array.isArray(existing.sessions)) existing.sessions = [];
            const seenInThisSession = existing.sessions.includes(sessionId);
            if (!seenInThisSession) {
                const previousCount = Number.isFinite(existing.sessionCount) ? existing.sessionCount : existing.sessions.length;
                existing.sessionCount = previousCount + 1;
                existing.sessions.push(sessionId);
                // Keep the most recent session references bounded; sessionCount remains
                // the cumulative distinct-session counter.
                if (existing.sessions.length > 500) existing.sessions = existing.sessions.slice(-500);
                existing.averageConfidence =
                    ((Number(existing.averageConfidence) || 0) * previousCount + confidence) /
                    existing.sessionCount;
            }

            // Update scam types (add new ones)
            if (!Array.isArray(existing.scamTypes)) existing.scamTypes = [];
            categories.forEach(cat => {
                if (typeof cat === 'string' && !existing.scamTypes.includes(cat)) {
                    existing.scamTypes.push(cat);
                }
            });

            // Escalate risk level if needed
            const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
            if (riskLevels.indexOf(riskLevel) > riskLevels.indexOf(existing.riskLevel)) {
                existing.riskLevel = riskLevel;
            }

            // Auto-blacklist only after distinct sessions, not repeated messages.
            if (existing.sessionCount >= 3 && existing.averageConfidence > 0.7) {
                existing.isBlacklisted = true;
            }

            await existing.save();

            console.log(`🔄 Updated known scammer record (${identifier.upiId ? 'UPI' : 'phone'}; ${existing.sessionCount} sessions)`);

        } else {
            // Create new record
            const newRecord = new ScammerIntelligence({
                ...identifier,
                sessionCount: 1,
                sessions: [sessionId],
                scamTypes: categories,
                averageConfidence: confidence,
                riskLevel
            });

            await newRecord.save();

            console.log(`🆕 New scammer tracked (${identifier.upiId ? 'UPI' : 'phone'} identifier)`);
        }
    } catch (error) {
        console.error('Scammer intelligence upsert failed');
    }
}

/**
 * Get full intelligence report for a scammer
 * @param {string} upiId - UPI ID
 * @returns {Object} - Full intelligence report
 */
async function getScammerReport(upiId) {
    try {
        return await ScammerIntelligence.findOne({ upiId });
    } catch (error) {
        console.error('Scammer report lookup failed');
        return null;
    }
}

module.exports = {
    checkKnownScammer,
    updateScammerIntelligence,
    getScammerReport
};
