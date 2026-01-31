// agent/callbackService.js

/**
 * Callback Service
 * Sends final intelligence report to the evaluation platform
 */

/**
 * Send final callback to evaluation endpoint
 * @param {string} sessionId - Session identifier
 * @param {Object} intelligence - Extracted intelligence data
 * @param {Object} sessionData - Session metadata
 * @returns {Object} - Callback response
 */
async function sendFinalCallback(sessionId, intelligence, sessionData) {
    const callbackUrl = process.env.EVALUATION_CALLBACK_URL;

    if (!callbackUrl || callbackUrl === 'https://evaluation-platform.example.com/callback') {
        console.log('⚠️  Evaluation callback URL not configured. Skipping callback.');
        console.log('📊 Intelligence Report:', JSON.stringify({
            sessionId,
            intelligence,
            sessionData
        }, null, 2));
        return { success: false, message: 'Callback URL not configured' };
    }

    const payload = {
        sessionId,
        timestamp: new Date().toISOString(),
        intelligence: {
            upiIds: intelligence.upiIds || [],
            phoneNumbers: intelligence.phoneNumbers || [],
            urls: intelligence.urls || [],
            scamPhrases: intelligence.scamPhrases || [],
            behavioralPatterns: intelligence.behavioralPatterns || []
        },
        sessionMetadata: {
            platform: sessionData.platform,
            sender: sessionData.sender,
            totalTurns: sessionData.totalTurns || 0,
            duration: sessionData.duration || 0,
            engagementPhase: sessionData.engagementPhase,
            scamConfidence: sessionData.scamConfidence || 0
        },
        summary: {
            scamDetected: sessionData.isScam || false,
            intelligenceExtracted: (
                intelligence.upiIds?.length > 0 ||
                intelligence.phoneNumbers?.length > 0 ||
                intelligence.urls?.length > 0
            ),
            totalIntelItems: (
                (intelligence.upiIds?.length || 0) +
                (intelligence.phoneNumbers?.length || 0) +
                (intelligence.urls?.length || 0)
            )
        }
    };

    try {
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Honeypot-Backend/1.0'
            },
            body: JSON.stringify(payload),
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`Callback failed with status ${response.status}`);
        }

        const responseData = await response.json();

        console.log('✅ Successfully sent callback to evaluation platform');
        console.log('📊 Response:', responseData);

        return {
            success: true,
            response: responseData
        };

    } catch (error) {
        console.error('❌ Failed to send callback:', error.message);

        return {
            success: false,
            error: error.message
        };
    }
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
