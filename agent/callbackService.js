// agent/callbackService.js

/**
 * Callback Service
 * Sends final intelligence report to the GUVI evaluation platform
 * MANDATORY for hackathon evaluation
 */

// GUVI evaluation endpoint — the default the hackathon requires. Setting EVALUATION_CALLBACK_URL
// overrides it (staging, testing, or a different evaluator); leave it empty in production.
const GUVI_DEFAULT_CALLBACK_URL = "https://hackathon.guvi.in/api/updateHoneyPotFinalResult";

/** The URL final reports are POSTed to, and where that choice came from. */
function getCallbackTarget() {
    const custom = (process.env.EVALUATION_CALLBACK_URL || "").trim();
    const url = custom || GUVI_DEFAULT_CALLBACK_URL;
    let host = url;
    try { host = new URL(url).host; } catch { /* keep raw */ }
    return { url, host, source: custom ? "env" : "default" };
}

/**
 * Send final callback to GUVI evaluation endpoint
 * This is MANDATORY and must be called after:
 * - Scam intent is confirmed
 * - AI Agent has completed engagement
 * - Intelligence extraction is finished
 * 
 * @param {string} sessionId - Session identifier
 * @param {Object} intelligence - Extracted intelligence data
 * @param {Object} sessionData - Session metadata
 * @returns {Object} - Callback response
 */
async function sendFinalCallback(sessionId, intelligence, sessionData) {
    // Build payload in GUVI's required format
    const payload = {
        sessionId: sessionId,
        scamDetected: true,
        totalMessagesExchanged: sessionData.totalTurns || 0,
        extractedIntelligence: {
            bankAccounts: [], // Not currently extracted, placeholder
            upiIds: intelligence.upiIds || [],
            phishingLinks: intelligence.urls || [],
            phoneNumbers: intelligence.phoneNumbers || [],
            suspiciousKeywords: intelligence.scamPhrases || []
        },
        agentNotes: generateAgentNotes(intelligence, sessionData)
    };

    // Do not log the extracted identifiers or full report payload; it can contain PII.

    try {
        // Use the shared DNS-pinned webhook client: callback URLs can be overridden
        // by deployment configuration, so they must not become an SSRF primitive.
        // It rejects private/reserved destinations, disallows redirects, and applies
        // a bounded timeout without fetching or logging an arbitrary response body.
        const { requestValidatedWebhook } = require('../src/utils/webhookUrlPolicy');
        const target = getCallbackTarget();
        const response = await requestValidatedWebhook(target.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Honeypot-Backend/1.0'
            },
            body: JSON.stringify(payload),
            timeoutMs: 15000
        });

        if (!response.ok) {
            console.error('Callback endpoint returned a non-success status:', response.status);
            return {
                success: false,
                error: 'Callback endpoint returned a non-success status'
            };
        }

        // Do not consume or log arbitrary evaluator response content; it is not
        // needed by the caller and could contain secrets or untrusted text.
        console.log('Successfully delivered final callback to configured evaluator');

        return {
            success: true,
            response: { status: response.status }
        };

    } catch (error) {
        // Validation, DNS, socket, and timeout errors can contain internal details.
        // Keep diagnostics low-risk and return a stable message to the pipeline.
        console.error('Callback delivery failed:', error?.name || 'Error');

        return {
            success: false,
            error: 'Callback delivery failed'
        };
    }
}

/**
 * Generate agent notes summarizing the scam tactics detected
 * @param {Object} intelligence - Extracted intelligence
 * @param {Object} sessionData - Session data
 * @returns {string} - Summary notes
 */
function generateAgentNotes(intelligence, sessionData) {
    const notes = [];

    if (intelligence.behavioralPatterns?.includes('urgency_tactics')) {
        notes.push('Scammer used urgency tactics');
    }
    if (intelligence.behavioralPatterns?.includes('authority_impersonation')) {
        notes.push('Authority impersonation detected');
    }
    if (intelligence.urls?.length > 0) {
        notes.push('Phishing links shared');
    }
    if (intelligence.upiIds?.length > 0) {
        notes.push('UPI payment redirection attempted');
    }
    if (intelligence.phoneNumbers?.length > 0) {
        notes.push('Phone numbers shared for contact');
    }
    if (sessionData.fsmState === 'TERMINATED') {
        notes.push('Conversation terminated due to abuse');
    }

    return notes.length > 0
        ? notes.join('. ') + '.'
        : 'Scam detected based on message patterns and behavioral analysis.';
}


/**
 * Format intelligence report for logging/debugging
 * @param {string} sessionId - Session identifier
 * @param {Object} intelligence - Extracted intelligence
 * @returns {string} - Formatted report
 */
function formatIntelligenceReport(sessionId, intelligence) {
    let report = `\n${'='.repeat(60)}\n`;
    report += `🔍 INTELLIGENCE REPORT - Session: ${sessionId}\n`;
    report += `${'='.repeat(60)}\n\n`;

    if (intelligence.upiIds && intelligence.upiIds.length > 0) {
        report += `💳 UPI IDs Found (${intelligence.upiIds.length}):\n`;
        intelligence.upiIds.forEach(id => report += `   - ${id}\n`);
        report += '\n';
    }

    if (intelligence.phoneNumbers && intelligence.phoneNumbers.length > 0) {
        report += `📱 Phone Numbers Found (${intelligence.phoneNumbers.length}):\n`;
        intelligence.phoneNumbers.forEach(num => report += `   - ${num}\n`);
        report += '\n';
    }

    if (intelligence.urls && intelligence.urls.length > 0) {
        report += `🔗 URLs Found (${intelligence.urls.length}):\n`;
        intelligence.urls.forEach(url => report += `   - ${url}\n`);
        report += '\n';
    }

    if (intelligence.scamPhrases && intelligence.scamPhrases.length > 0) {
        report += `🚨 Scam Phrases Detected (${intelligence.scamPhrases.length}):\n`;
        intelligence.scamPhrases.slice(0, 5).forEach(phrase => report += `   - "${phrase}"\n`);
        if (intelligence.scamPhrases.length > 5) {
            report += `   ... and ${intelligence.scamPhrases.length - 5} more\n`;
        }
        report += '\n';
    }

    if (intelligence.behavioralPatterns && intelligence.behavioralPatterns.length > 0) {
        report += `🎭 Behavioral Patterns (${intelligence.behavioralPatterns.length}):\n`;
        intelligence.behavioralPatterns.forEach(pattern => report += `   - ${pattern}\n`);
        report += '\n';
    }

    report += `${'='.repeat(60)}\n`;

    return report;
}

module.exports = {
    sendFinalCallback,
    getCallbackTarget,
    formatIntelligenceReport
};
