// detection/advancedDetector.js

/**
 * Advanced Multi-Level Scam Detection System
 * Uses layered analysis for higher accuracy
 */

const { SCAM_PATTERNS, SCAM_PHRASES } = require('./keywordRules');
const { extractIntelligence } = require('./intelligenceExtractor');

/**
 * Advanced scam detection with multi-layered analysis
 * @param {string} message - Message to analyze
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Object} - Detailed detection results
 */
function advancedScamDetection(message, conversationHistory = []) {
    const msg = message.toLowerCase();

    // Layer 1: Pattern Matching (Base)
    const patternScore = analyzePatterns(msg);

    // Layer 2: Behavioral Analysis
    const behaviorScore = analyzeBehavior(msg, conversationHistory);

    // Layer 3: Contextual Analysis
    const contextScore = analyzeContext(msg, conversationHistory);

    // Layer 4: Intelligence Cross-Reference
    const intelScore = analyzeIntelligence(message);

    // Layer 5: Urgency & Pressure Tactics
    const urgencyScore = analyzeUrgency(msg);

    // Weighted scoring system
    const weights = {
        pattern: 0.35,
        behavior: 0.20,
        context: 0.20,
        intelligence: 0.15,
        urgency: 0.10
    };

    const totalScore = (
        patternScore.score * weights.pattern +
        behaviorScore.score * weights.behavior +
        contextScore.score * weights.context +
        intelScore.score * weights.intelligence +
        urgencyScore.score * weights.urgency
    );

    // Determine categories
    const categories = [
        ...patternScore.categories,
        ...behaviorScore.categories,
        ...contextScore.categories
    ];
    const uniqueCategories = [...new Set(categories)];

    // Risk level classification
    const riskLevel = getRiskLevel(totalScore);

    return {
        isScam: totalScore > 0.3, // 30% threshold
        confidence: Math.min(totalScore, 1.0),
        riskLevel,
        categories: uniqueCategories,
        category: uniqueCategories[0] || null,
        detectedPatterns: [
            ...patternScore.patterns,
            ...behaviorScore.patterns,
            ...contextScore.patterns
        ],
        analysis: {
            patternScore: patternScore.score,
            behaviorScore: behaviorScore.score,
            contextScore: contextScore.score,
            intelScore: intelScore.score,
            urgencyScore: urgencyScore.score,
            totalScore
        }
    };
}

/**
 * Layer 1: Pattern matching analysis
 */
function analyzePatterns(msg) {
    let score = 0;
    const categories = [];
    const patterns = [];

    for (const [category, regexList] of Object.entries(SCAM_PATTERNS)) {
        for (const regex of regexList) {
            if (regex.test(msg)) {
                score += 0.15;
                categories.push(category);
                patterns.push(regex.source);
            }
        }
    }

    // Phrase matching (higher weight)
    for (const phrase of SCAM_PHRASES) {
        if (msg.includes(phrase.toLowerCase())) {
            score += 0.20;
            patterns.push(phrase);
        }
    }

    return {
        score: Math.min(score, 1.0),
        categories: [...new Set(categories)],
        patterns
    };
}

/**
 * Layer 2: Behavioral analysis
 */
function analyzeBehavior(msg, history) {
    let score = 0;
    const categories = [];
    const patterns = [];

    // Repetitive requests
    if (history.length > 0) {
        const userMessages = history.filter(h => h.role === 'user').map(h => h.text.toLowerCase());
        const similarMessages = userMessages.filter(m =>
            calculateSimilarity(msg, m) > 0.6
        ).length;

        if (similarMessages > 0) {
            score += 0.3;
            patterns.push('repetitive_requests');
        }
    }

    // Multiple requests in quick succession
    if (history.length >= 3) {
        const recentUserMessages = history.filter(h => h.role === 'user').slice(-3);
        const hasMultipleRequests = recentUserMessages.every(m =>
            /send|share|give|provide|verify/i.test(m.text)
        );

        if (hasMultipleRequests) {
            score += 0.25;
            patterns.push('aggressive_persistence');
            categories.push('urgency');
        }
    }

    // Escalating pressure
    const pressureWords = ['urgent', 'immediately', 'now', 'quickly', 'hurry'];
    const pressureCount = pressureWords.filter(word => msg.includes(word)).length;
    if (pressureCount >= 2) {
        score += 0.2;
        patterns.push('escalating_pressure');
    }

    return { score: Math.min(score, 1.0), categories, patterns };
}

/**
 * Layer 3: Contextual analysis
 */
function analyzeContext(msg, history) {
    let score = 0;
    const categories = [];
    const patterns = [];

    // Unsolicited contact about money/prizes
    if (history.length === 0 || history.length === 1) {
        if (/won|prize|lottery|free|earn|money/i.test(msg)) {
            score += 0.4;
            categories.push('phishing');
            patterns.push('unsolicited_prize');
        }
    }

    // Requesting sensitive info early in conversation
    if (history.length < 3) {
        if (/otp|pin|password|cvv|card|account.*details/i.test(msg)) {
            score += 0.5;
            categories.push('banking');
            patterns.push('early_sensitive_request');
        }
    }

    // Mixed messaging (prize + payment required)
    if (/won|prize|free/i.test(msg) && /pay|send|money|fee/i.test(msg)) {
        score += 0.6;
        categories.push('phishing');
        patterns.push('prize_with_payment_paradox');
    }

    // Authority impersonation
    if (/bank|rbi|government|police|tax|income.*tax/i.test(msg)) {
        score += 0.3;
        categories.push('banking');
        patterns.push('authority_impersonation');
    }

    return { score: Math.min(score, 1.0), categories, patterns };
}

/**
 * Layer 4: Intelligence cross-reference
 */
function analyzeIntelligence(message) {
    const intel = extractIntelligence(message);
    let score = 0;

    // Has UPI ID = likely scam
    if (intel.upiIds.length > 0) {
        score += 0.5;
    }

    // Has phone number in unsolicited message
    if (intel.phoneNumbers.length > 0) {
        score += 0.3;
    }

    // Has suspicious URLs
    if (intel.urls.length > 0) {
        const suspiciousUrls = intel.urls.filter(url =>
            !url.includes('gov.in') &&
            !url.includes('official') &&
            !url.includes('https://')
        );
        if (suspiciousUrls.length > 0) {
            score += 0.4;
        }
    }

    // Multiple intelligence types = higher risk
    const intelTypes = [
        intel.upiIds.length > 0,
        intel.phoneNumbers.length > 0,
        intel.urls.length > 0
    ].filter(Boolean).length;

    if (intelTypes >= 2) {
        score += 0.3;
    }

    return { score: Math.min(score, 1.0) };
}

/**
 * Layer 5: Urgency analysis
 */
function analyzeUrgency(msg) {
    let score = 0;

    const urgencyIndicators = {
        time: /urgent|immediate|now|quickly|hurry|asap|today|hour/i,
        threat: /block|suspend|freeze|deactivate|expire|lose|close/i,
        action: /act|verify|confirm|update|send|click|call/i
    };

    let matchCount = 0;
    for (const [type, regex] of Object.entries(urgencyIndicators)) {
        if (regex.test(msg)) {
            matchCount++;
            score += 0.25;
        }
    }

    // Multiple urgency types = very suspicious
    if (matchCount >= 2) {
        score += 0.3;
    }

    return { score: Math.min(score, 1.0) };
}

/**
 * Calculate text similarity (Jaccard similarity)
 */
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

/**
 * Get risk level classification
 */
function getRiskLevel(score) {
    if (score >= 0.8) return 'CRITICAL';
    if (score >= 0.6) return 'HIGH';
    if (score >= 0.4) return 'MEDIUM';
    if (score >= 0.2) return 'LOW';
    return 'SAFE';
}

module.exports = {
    advancedScamDetection
};
