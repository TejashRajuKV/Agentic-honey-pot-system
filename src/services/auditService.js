// src/services/auditService.js

const AuditLog = require('../models/AuditLog');

/**
 * Enhanced Audit Logging Service
 * Professional-grade tracking for all honeypot activities
 */

/**
 * Log any event
 * @param {string} eventType - Type of event
 * @param {Object} data - Event data
 */
async function logEvent(eventType, data) {
    try {
        const logEntry = new AuditLog({
            eventType,
            ...data,
            timestamp: new Date()
        });

        await logEntry.save();

        // Console log for development
        if (process.env.NODE_ENV === 'development') {
            console.log(`📝 [AUDIT] ${eventType}:`, JSON.stringify(data.sessionId || 'N/A'));
        }
    } catch (error) {
        console.error('Audit logging error:', error);
    }
}

/**
 * Log session start
 */
async function logSessionStart(sessionId, platform, sender) {
    await logEvent('SESSION_START', {
        sessionId,
        platform,
        sender,
        notes: 'New conversation initiated'
    });
}

/**
 * Log incoming message
 */
async function logMessageReceived(sessionId, message, detection, intelligence, knownScammer) {
    await logEvent('MESSAGE_RECEIVED', {
        sessionId,
        incomingMessage: message,
        detection,
        intelligence,
        knownScammer
    });
}

/**
 * Log scam detection
 */
async function logScamDetected(sessionId, detection, intelligence) {
    await logEvent('SCAM_DETECTED', {
        sessionId,
        detection,
        intelligence,
        notes: `Scam detected with ${(detection.confidence * 100).toFixed(0)}% confidence`
    });
}

/**
 * Log agent response
 */
async function logAgentResponse(sessionId, response, agentState, baitUsed) {
    await logEvent('AGENT_RESPONSE', {
        sessionId,
        outgoingMessage: response,
        agentState,
        notes: baitUsed ? `Bait deployed: ${agentState.baitType}` : 'Standard engagement'
    });
}

/**
 * Log bait deployment
 */
async function logBaitDeployed(sessionId, baitType, phase) {
    await logEvent('BAIT_DEPLOYED', {
        sessionId,
        agentState: { baitType, phase },
        notes: `Strategic bait: ${baitType}`
    });
}

/**
 * Log intelligence extraction
 */
async function logIntelligenceExtracted(sessionId, intelligence) {
    await logEvent('INTELLIGENCE_EXTRACTED', {
        sessionId,
        intelligence,
        notes: `Extracted: ${Object.keys(intelligence).filter(k => intelligence[k]?.length > 0).join(', ')}`
    });
}

/**
 * Log repeat scammer detection
 */
async function logRepeatScammer(sessionId, scammerInfo) {
    await logEvent('REPEAT_SCAMMER_DETECTED', {
        sessionId,
        knownScammer: {
            isKnown: true,
            previousSessions: scammerInfo.sessionCount,
            riskLevel: scammerInfo.riskLevel
        },
        notes: `Known scammer - ${scammerInfo.sessionCount} previous sessions`
    });
}

/**
 * Log session termination
 */
async function logSessionTerminated(sessionId, reason, finalIntel) {
    await logEvent('SESSION_TERMINATED', {
        sessionId,
        intelligence: finalIntel,
        notes: `Session ended: ${reason}`
    });
}

/**
 * Log callback sent
 */
async function logCallbackSent(sessionId, callbackData, success) {
    await logEvent('CALLBACK_SENT', {
        sessionId,
        notes: success ? 'Callback sent successfully' : 'Callback failed',
        detection: callbackData
    });
}

/**
 * Get audit trail for a session
 * @param {string} sessionId - Session ID
 * @returns {Array} - Audit log entries
 */
async function getSessionAudit(sessionId) {
    try {
        return await AuditLog.find({ sessionId }).sort({ timestamp: 1 });
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        return [];
    }
}

/**
 * Get audit summary statistics
 * @returns {Object} - Summary statistics
 */
async function getAuditStats() {
    try {
        const totalSessions = await AuditLog.distinct('sessionId').countDocuments();
        const scamsDetected = await AuditLog.countDocuments({ eventType: 'SCAM_DETECTED' });
        const baitsDeployed = await AuditLog.countDocuments({ eventType: 'BAIT_DEPLOYED' });
        const repeatScammers = await AuditLog.countDocuments({ eventType: 'REPEAT_SCAMMER_DETECTED' });

        return {
            totalSessions,
            scamsDetected,
            baitsDeployed,
            repeatScammers
        };
    } catch (error) {
        console.error('Error fetching audit stats:', error);
        return null;
    }
}

module.exports = {
    logEvent,
    logSessionStart,
    logMessageReceived,
    logScamDetected,
    logAgentResponse,
    logBaitDeployed,
    logIntelligenceExtracted,
    logRepeatScammer,
    logSessionTerminated,
    logCallbackSent,
    getSessionAudit,
    getAuditStats
};
