// detection/scamDetector.js

const { advancedScamDetection } = require('./advancedDetector');
const {
    generateReasoningLayer,
    generateSafetyAdvice,
    calculatePressureVelocity,
    detectUserVulnerability,
    classifyScamArchetype,
    applyConfidenceDecayProtection,
    handleUserLegitimacyClaim
} = require('./scamAnalysisEngine');

/**
 * Enhanced Scam Detection Module
 * Uses advanced multi-layered analysis for superior accuracy
 * 
 * NEW: Includes 8 advanced features:
 * 1️⃣ Risk Explanation Layer (WHY it's a scam)
 * 2️⃣ User Safety Guidance (Actionable advice)
 * 4️⃣ Pressure Velocity Score (How fast escalated)
 * 5️⃣ User Vulnerability Detection (Victim assessment)
 * 6️⃣ Scam Archetype Label (Classification)
 * 7️⃣ Confidence Decay Protection (Lock confidence)
 * 8️⃣ User Override Handling (Claims of legitimacy)
 */

/**
 * Detect scam intent in a message with advanced analysis
 * @param {string} message - The message to analyze
 * @param {Array} conversationHistory - Optional conversation history for context
 * @param {Object} sessionData - Session context for confidence decay protection
 * @returns {Object} - Enhanced detection result with new features
 */
async function detectScamIntent(message, conversationHistory = [], sessionData = {}) {
    if (!message || typeof message !== 'string') {
        return {
            isScam: false,
            confidence: 0,
            riskLevel: 'SAFE',
            detectedPatterns: [],
            categories: [],
            category: null,
            analysis: null,
            reasoning: [],
            safetyAdvice: [],
            pressureVelocity: { velocity: 'slow', score: 0 },
            userVulnerability: { vulnerability: 'low', indicators: [], score: 0 },
            scamType: 'UNKNOWN_SCAM',
            confidenceLocked: false,
            userClaimedLegitimate: false
        };
    }

    // Use advanced multi-layered detection
    let baseResult = advancedScamDetection(message, conversationHistory);

    // FEATURE ADDITION: Language Service Integration
    // Enhance detection with language-specific analysis (e.g., Hinglish scams)
    const languageService = require('../src/services/languageService');
    baseResult = languageService.enhanceDetectionWithLanguage(message, baseResult);

    // Feature 1️⃣: Generate reasoning layer (WHY it's a scam)
    const reasoning = generateReasoningLayer(
        message,
        conversationHistory,
        baseResult.detectedPatterns,
        baseResult.categories
    );

    // Feature 2️⃣: Generate safety advice (only if scamProbability > 50)
    let safetyAdvice = [];
    if (baseResult.confidence > 0.5) {
        safetyAdvice = generateSafetyAdvice(
            message,
            baseResult.confidence * 100,
            baseResult.detectedPatterns
        );
    }

    // Feature 4️⃣: Calculate pressure velocity
    const pressureVelocity = calculatePressureVelocity(conversationHistory, message);

    // Feature 5️⃣: Detect user vulnerability
    const userVulnerability = detectUserVulnerability(message, conversationHistory);

    // Feature 6️⃣: Classify scam archetype
    const scamType = classifyScamArchetype(message, baseResult.detectedPatterns, baseResult.categories);

    // Feature 8️⃣: Check for user claims of legitimacy (before decay protection)
    const legitimacyCheck = handleUserLegitimacyClaim(message, baseResult.confidence);
    const userClaimedLegitimate = legitimacyCheck.userClaimedLegitimate;
    let adjustedConfidence = legitimacyCheck.adjustedConfidence;

    // Feature 7️⃣: Apply confidence decay protection
    const decayProtection = applyConfidenceDecayProtection(
        adjustedConfidence,
        sessionData.previousConfidence || 0,
        sessionData.confidenceLocked || false
    );

    const finalConfidence = decayProtection.confidence;
    const confidenceLocked = decayProtection.isLocked;

    // Return enhanced result
    return {
        isScam: baseResult.isScam,
        confidence: finalConfidence,
        riskLevel: baseResult.riskLevel,
        detectedPatterns: baseResult.detectedPatterns,
        categories: baseResult.categories,
        category: baseResult.category,
        analysis: baseResult.analysis,
        // NEW FEATURES:
        reasoning,                      // 1️⃣ Why it's a scam
        safetyAdvice,                   // 2️⃣ Actionable advice
        pressureVelocity,               // 4️⃣ How fast escalated
        userVulnerability,              // 5️⃣ Victim vulnerability
        scamType,                       // 6️⃣ Archetype label
        confidenceLocked,               // 7️⃣ Confidence locked flag
        userClaimedLegitimate           // 8️⃣ User override claim
    };
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
