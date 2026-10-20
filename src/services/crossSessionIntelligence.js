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
    const maxAttempts = 3;
    const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
            const existing = await ScammerIntelligence.findOne(identifier);

            if (existing) {
                // Optimistic concurrency (enabled on the schema) makes simultaneous
                // read/modify/save operations conflict rather than silently overwrite.
                existing.lastSeenAt = new Date();
                if (!Array.isArray(existing.sessions)) existing.sessions = [];
                const seenInThisSession = existing.sessions.includes(sessionId);
                if (!seenInThisSession) {
                    const previousCount = Number.isFinite(existing.sessionCount)
                        ? existing.sessionCount
                        : existing.sessions.length;
                    existing.sessionCount = previousCount + 1;
                    existing.sessions.push(sessionId);
                    if (existing.sessions.length > 500) existing.sessions = existing.sessions.slice(-500);
                    existing.averageConfidence =
                        ((Number(existing.averageConfidence) || 0) * previousCount + confidence) /
                        existing.sessionCount;
                }

                if (!Array.isArray(existing.scamTypes)) existing.scamTypes = [];
                existing.scamTypes = [...new Set([
                    ...existing.scamTypes.filter((value) => typeof value === 'string' && value.trim()),
                    ...categories
                ])].slice(-100);

                if (riskLevels.indexOf(riskLevel) > riskLevels.indexOf(existing.riskLevel)) {
                    existing.riskLevel = riskLevel;
                }
                if (existing.sessionCount >= 3 && existing.averageConfidence > 0.7) {
                    existing.isBlacklisted = true;
                }

                await existing.save();
                return;
            }

            const newRecord = new ScammerIntelligence({
                ...identifier,
                sessionCount: 1,
                sessions: [sessionId],
                scamTypes: categories,
                averageConfidence: confidence,
                riskLevel
            });
            await newRecord.save();
            return;
        } catch (error) {
            const retryable = error?.name === 'VersionError' || error?.code === 11000;
            if (retryable && attempt < maxAttempts - 1) {
                // Re-read after a concurrent writer wins. Duplicate-key retries
                // also handle deployments that add a unique index after cleanup.
                continue;
            }
            console.error('Scammer intelligence upsert failed');
            return;
        }
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
