// detection/scamDetector.js

const { advancedScamDetection } = require('./advancedDetector');

/**
 * Enhanced Scam Detection Module
 * Uses advanced multi-layered analysis for superior accuracy
 */

/**
 * Detect scam intent in a message with advanced analysis
 * @param {string} message - The message to analyze
 * @param {Array} conversationHistory - Optional conversation history for context
 * @returns {Object} - Enhanced detection result
 */
async function detectScamIntent(message, conversationHistory = []) {
    if (!message || typeof message !== 'string') {
        return {
            isScam: false,
            confidence: 0,
            riskLevel: 'SAFE',
            detectedPatterns: [],
            categories: [],
            category: null,
            analysis: null
        };
    }

    // Use advanced multi-layered detection
    const result = advancedScamDetection(message, conversationHistory);

    return result;
}

/**
 * Analyze conversation history for scam patterns
 * @param {Array} conversationHistory - Array of previous messages
 * @returns {Object} - Analysis result
 */
async function analyzeConversationHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return {
            isScam: false,
            overallConfidence: 0,
            riskLevel: 'SAFE',
            patterns: []
        };
    }

    const allDetections = [];
    let maxRiskLevel = 'SAFE';

    for (const turn of conversationHistory) {
        if (turn.role === 'user') {
            const detection = await detectScamIntent(turn.text, conversationHistory);
            if (detection.isScam) {
                allDetections.push(detection);

                // Track highest risk level
                const riskLevels = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
                if (riskLevels.indexOf(detection.riskLevel) > riskLevels.indexOf(maxRiskLevel)) {
                    maxRiskLevel = detection.riskLevel;
                }
            }
        }
    }

    // Calculate overall confidence
    const avgConfidence = allDetections.length > 0
        ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / allDetections.length
        : 0;

    return {
        isScam: avgConfidence >= 0.3,
        overallConfidence: avgConfidence,
        riskLevel: maxRiskLevel,
        patterns: allDetections,
        totalScamMessages: allDetections.length
    };
}

module.exports = {
    detectScamIntent,
    analyzeConversationHistory
};
