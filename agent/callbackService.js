// agent/callbackService.js

/**
 * Callback Service
 * Sends final intelligence report to the GUVI evaluation platform
 * MANDATORY for hackathon evaluation
 */

// GUVI Evaluation Endpoint (hardcoded as required)
const GUVI_CALLBACK_URL = "https://hackathon.guvi.in/api/updateHoneyPotFinalResult";

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

    console.log('📤 Sending final result to GUVI evaluation endpoint...');
    console.log('📊 Payload:', JSON.stringify(payload, null, 2));

    try {
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(GUVI_CALLBACK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Honeypot-Backend/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 15000 // 15 second timeout
        });

        if (!response.ok) {
            throw new Error(`Callback failed with status ${response.status}`);
        }

        let responseData;
        try {
            responseData = await response.json();
        } catch {
            responseData = { status: 'acknowledged' };
        }

        console.log('✅ Successfully sent final result to GUVI');
        console.log('📊 Response:', responseData);

        return {
            success: true,
            response: responseData
        };

    } catch (error) {
        console.error('❌ Failed to send callback to GUVI:', error.message);

        return {
            success: false,
            error: error.message
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
    formatIntelligenceReport
};
