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
        const cleanValues = (values) => Array.isArray(values)
            ? [...new Set(values
                .filter((value) => typeof value === 'string' && value.trim() && value.length <= 256)
                .map((value) => value.trim()))].slice(0, 50)
            : [];
        const cleanUpiIds = cleanValues(upiIds);
        const cleanPhoneNumbers = cleanValues(phoneNumbers);
        if (cleanUpiIds.length === 0 && cleanPhoneNumbers.length === 0) {
            return { isKnown: false };
        }

        // Only query identifier classes with actual candidate values. Avoid broad
        // empty-$in clauses and keep lookup work bounded for untrusted input.
        const clauses = [];
        if (cleanUpiIds.length) clauses.push({ upiId: { $in: cleanUpiIds } });
        if (cleanPhoneNumbers.length) clauses.push({ phoneNumber: { $in: cleanPhoneNumbers } });
        const knownScammer = await ScammerIntelligence.findOne({ $or: clauses })
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
        if (!intelligence || typeof intelligence !== 'object' || Array.isArray(intelligence) ||
            typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 200) {
            return;
        }
        const cleanValues = (values) => Array.isArray(values)
            ? [...new Set(values.filter((value) => typeof value === 'string' && value.trim() && value.length <= 256))].slice(0, 50)
            : [];
        const upiIds = cleanValues(intelligence.upiIds);
        const phoneNumbers = cleanValues(intelligence.phoneNumbers);
        const context = scamContext && typeof scamContext === 'object' ? scamContext : {};
        const confidenceValue = Number(context.confidence);
        const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0;
        const allowedRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        const riskLevel = allowedRiskLevels.includes(context.riskLevel) ? context.riskLevel : 'MEDIUM';
        const categories = Array.isArray(context.categories)
            ? [...new Set(context.categories.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.slice(0, 100)))].slice(0, 50)
            : [];

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
            existing.scamTypes = [...new Set([
                ...existing.scamTypes.filter((value) => typeof value === 'string' && value.trim()),
                ...categories
            ])].slice(-100);

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
