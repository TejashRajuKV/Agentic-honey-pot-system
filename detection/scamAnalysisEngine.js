/**
 * Scam Analysis Engine - Advanced Analysis Layer
 * 
 * Provides comprehensive analysis features:
 * 1️⃣ Risk Explanation Layer - WHY it's a scam
 * 2️⃣ User Safety Guidance - Actionable advice
 * 4️⃣ Pressure Velocity Score - How fast escalated
 * 5️⃣ User Vulnerability Detection - Victim assessment
 * 6️⃣ Scam Archetype Label - Classification
 * 7️⃣ Confidence Decay Protection - Lock confidence
 * 8️⃣ User Override Handling - Claims of legitimacy
 */

/**
 * Generate reasoning explaining WHY the message is detected as a scam
 * @param {string} message - The analyzed message
 * @param {Array} conversationHistory - Conversation context
 * @param {Array} detectedPatterns - Patterns found by detector
 * @param {Array} categories - Scam categories detected
 * @returns {Array} - Array of reasoning strings
 */
function generateReasoningLayer(message, conversationHistory = [], detectedPatterns = [], categories = []) {
    const reasoning = [];
    const msg = message.toLowerCase();

    // Map patterns to human-readable explanations
    const patternExplanations = {
        // Authentication & OTP
        'otp_fraud': 'OTP requested over chat (never requested by legitimate banks)',
        'otp_request': 'OTP/code requested over chat',
        'otp': 'OTP solicitation detected',
        'code_request': 'Secret code/PIN requested',
        'password_request': 'Password requested over chat',
        'verify_account': 'Account verification pretext',

        // Banking Fraud
        'bank_impersonation': 'Impersonation of bank authority',
        'rbi_claim': 'False claim of RBI/regulatory involvement',
        'bank_name': 'Bank name used inappropriately',
        'account_issue': 'Fake account/security alert',
        'transaction_issue': 'Transaction problems (likely pretext)',

        // Money Movement
        'payment_request': 'Payment/transfer requested',
        'money_request': 'Money transfer requested',
        'investment_offer': 'Investment or financial opportunity',
        'fund_transfer': 'Fund transfer initiated',

        // Tech Support
        'tech_support_scam': 'Tech support scam indicators',
        'system_alert': 'Fake system/virus alerts',
        'remote_access': 'Requesting remote access to device',
        'app_download': 'Suspicious app download request',

        // Prize/Reward Fraud
        'prize_scam': 'Prize/reward/lottery claim',
        'lottery_claim': 'Lottery or prize claim',
        'reward_offer': 'Fake rewards or prizes',
        'winnings': 'Undeserved winnings claim',

        // Authority/Legal Threats
        'legal_threat': 'Legal threats or law enforcement impersonation',
        'police_threat': 'Police/legal action threat',
        'arrest_warning': 'Arrest warning (intimidation)',
        'tax_issue': 'Fake tax/compliance issue',
        'complaint_threat': 'Threat of complaint or investigation',

        // Social Engineering
        'authority_impersonation': 'Authority figure impersonation',
        'urgency_escalation': 'Artificial urgency created',
        'pressure_tactics': 'High-pressure tactics detected',
        'trust_building': 'Unusual trust-building attempts',
        'friend_in_need': 'Friend/family emergency (social engineering)',

        // Behavioral Red Flags
        'repetitive_requests': 'Repeated similar requests (persistence)',
        'aggressive_persistence': 'Aggressive follow-up pattern',
        'escalating_pressure': 'Pressure escalating with each message',
        'slow_burn': 'Slow-burn pattern (gradual escalation)',
        'silent_pressure': 'Persistent requests without explicit threats',
        'emotional_manipulation': 'Emotional manipulation tactics'
    };

    // Add explanations for detected patterns
    for (const pattern of detectedPatterns) {
        if (patternExplanations[pattern]) {
            reasoning.push(patternExplanations[pattern]);
        }
    }

    // Add category-based explanations
    const categoryExplanations = {
        'urgency': 'Artificial urgency or time pressure detected',
        'authority': 'Authority impersonation (bank/police/RBI)',
        'financial': 'Financial solicitation detected',
        'verification': 'Unnecessary verification requests',
        'reward': 'Suspicious reward/prize claim',
        'threat': 'Intimidation or threat language',
        'tech': 'Technology-related pretext',
        'slow_burn': 'Gradual escalation pattern (slow-burn scam)',
        'silent_pressure': 'Persistent pressure without explicit threats'
    };

    for (const category of categories) {
        if (categoryExplanations[category] && !reasoning.includes(categoryExplanations[category])) {
            reasoning.push(categoryExplanations[category]);
        }
    }

    // Generic fallback if no specific patterns matched
    if (reasoning.length === 0 && detectedPatterns.length > 0) {
        reasoning.push('Scam-like communication patterns detected');
    }

    return reasoning;
}

/**
 * Generate user safety advice when scamProbability > 50
 * @param {string} message - The analyzed message
 * @param {number} scamProbability - Detection confidence (0-100)
 * @param {Array} detectedPatterns - Patterns found
 * @returns {Array} - Safety advice strings
 */
function generateSafetyAdvice(message, scamProbability = 0, detectedPatterns = []) {
    const advice = [];

    // Base safety advice for all scams
    advice.push('Do not share OTP, PIN, or passwords');
    advice.push('Do not click links or download files');

    // Pattern-specific advice
    const msg = message.toLowerCase();

    if (/otp|code|password|pin/i.test(msg)) {
        advice.push('Banks never ask for OTP/PIN via chat');
    }

    if (/link|url|click|download|app|install/i.test(msg)) {
        advice.push('Do not click suspicious links or download apps');
    }

    if (/payment|transfer|amount|money/i.test(msg)) {
        advice.push('Do not make any payments or transfers');
        advice.push('Verify with your bank using official app/number');
    }

    if (/bank|rbi|rbai|police|police|authority|officer/i.test(msg)) {
        advice.push('Contact your bank via official app or phone number');
        advice.push('Verify through official channels before responding');
    }

    if (/urgent|immediate|quickly|now|hurry/i.test(msg)) {
        advice.push('Take time to verify before acting on urgent requests');
    }

    // Add generic blocking advice
    if (!advice.includes('Block and report the number/contact')) {
        advice.push('Block and report the sender');
    }

    // Remove duplicates while maintaining order
    return Array.from(new Set(advice));
}

/**
 * Calculate Pressure Velocity Score
 * How fast the scammer is escalating pressure
 * @param {Array} conversationHistory - Message history
 * @param {string} currentMessage - Latest message
 * @returns {Object} - { velocity: "fast" | "medium" | "slow", score: 0-1 }
 */
function calculatePressureVelocity(conversationHistory = [], currentMessage = '') {
    const urgencyWords = ['urgent', 'immediately', 'now', 'quickly', 'hurry', 'asap', 'cannot wait'];
    const pressureWords = ['must', 'need', 'have to', 'only way', 'right now'];
    const requestWords = ['send', 'share', 'give', 'provide', 'tell', 'verify', 'confirm'];

    if (!conversationHistory || conversationHistory.length === 0) {
        // First message - check if it has pressure words
        const urgencyCount = urgencyWords.filter(w => currentMessage.toLowerCase().includes(w)).length;
        const pressureCount = pressureWords.filter(w => currentMessage.toLowerCase().includes(w)).length;

        if (urgencyCount + pressureCount >= 2) {
            return { velocity: 'fast', score: 0.7 };
        }
        return { velocity: 'slow', score: 0.1 };
    }

    // Analyze escalation pattern
    const userMessages = conversationHistory
        .filter(h => h.role === 'user')
        .map(h => h.text.toLowerCase());

    let pressureProgression = [];
    for (const msg of userMessages) {
        const urgencyCount = urgencyWords.filter(w => msg.includes(w)).length;
        const pressureCount = pressureWords.filter(w => msg.includes(w)).length;
        pressureProgression.push(urgencyCount + pressureCount);
    }

    // Add current message
    const currentUrgency = urgencyWords.filter(w => currentMessage.toLowerCase().includes(w)).length;
    const currentPressure = pressureWords.filter(w => currentMessage.toLowerCase().includes(w)).length;
    pressureProgression.push(currentUrgency + currentPressure);

    // Calculate escalation rate
    const turnCount = userMessages.length + 1;

    if (turnCount <= 2) {
        // OTP in first 2 messages = FAST escalation
        if ((currentUrgency + currentPressure) >= 2) {
            return { velocity: 'fast', score: 0.8 };
        }
        return { velocity: 'slow', score: 0.2 };
    }

    // Calculate escalation trend
    const firstHalf = pressureProgression.slice(0, Math.floor(pressureProgression.length / 2));
    const secondHalf = pressureProgression.slice(Math.floor(pressureProgression.length / 2));

    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b) / secondHalf.length : 0;

    const escalationRate = secondAvg - firstAvg;

    if (escalationRate > 1.5) {
        return { velocity: 'fast', score: 0.8 };
    } else if (escalationRate > 0.5) {
        return { velocity: 'medium', score: 0.5 };
    } else {
        return { velocity: 'slow', score: 0.3 };
    }
}

/**
 * Detect User Vulnerability
 * Identifies if victim shows signs of being vulnerable
 * @param {string} message - Current message
 * @param {Array} conversationHistory - Previous messages
 * @returns {Object} - { vulnerability: "high" | "medium" | "low", indicators: Array }
 */
function detectUserVulnerability(message = '', conversationHistory = []) {
    const vulnerabilityPatterns = {
        'high': [
            /i'm? scared|i'm? afraid|i'm? frightened/i,
            /please help|help me|what should i do/i,
            /i don't? understand|can't understand|confused/i,
            /i'm? sorry|my mistake|i'm? stupid/i,
            /what if.*police|what if.*arrest|what if.*action/i,
            /they said.*block/i,
            /my account.*locked|cannot access/i,
            /i'm? worried|i'm? anxious|panic/i,
            /i have no choice|what should i do|tell me what to do/i
        ],
        'medium': [
            /maybe|i guess|i think|perhaps/i,
            /should i|can i|may i/i,
            /what does.*mean|can you explain/i,
            /is it.*safe|is it.*okay/i,
            /but i/i
        ]
    };

    let highCount = 0;
    let mediumCount = 0;
    let indicators = [];

    // Check current message
    for (const pattern of vulnerabilityPatterns.high) {
        if (pattern.test(message)) {
            highCount++;
            indicators.push(pattern.source.substring(0, 30));
        }
    }

    for (const pattern of vulnerabilityPatterns.medium) {
        if (pattern.test(message)) {
            mediumCount++;
        }
    }

    // Check conversation history for vulnerability escalation
    if (conversationHistory.length > 0) {
        const userMessages = conversationHistory.filter(h => h.role === 'user');
        const recentMessages = userMessages.slice(-3);

        let historyVulnerability = 0;
        for (const msg of recentMessages) {
            for (const pattern of vulnerabilityPatterns.high) {
                if (pattern.test(msg.text)) {
                    historyVulnerability++;
                }
            }
        }

        highCount = Math.max(highCount, Math.min(historyVulnerability, 2));
    }

    // Determine vulnerability level
    let vulnerability = 'low';
    if (highCount >= 2) {
        vulnerability = 'high';
    } else if (highCount >= 1 || mediumCount >= 3) {
        vulnerability = 'medium';
    }

    return {
        vulnerability,
        indicators,
        score: highCount * 0.4 + mediumCount * 0.2
    };
}

/**
 * Classify scam archetype
 * @param {string} message - The message to analyze
 * @param {Array} detectedPatterns - Patterns found by detector
 * @param {Array} categories - Categories detected
 * @returns {string} - Scam type label
 */
function classifyScamArchetype(message = '', detectedPatterns = [], categories = []) {
    const msg = message.toLowerCase();

    // Check for OTP fraud patterns
    if (/otp|code|password|pin|verify.*code|confirm.*code/i.test(msg) ||
        detectedPatterns.includes('otp_request') ||
        detectedPatterns.includes('otp_fraud')) {
        return 'OTP_FRAUD';
    }

    // Check for bank impersonation
    if (/bank|rbi|rbai|reserve.*bank|axis|icici|hdfc|sbi|verify.*account|security alert|account.*locked/i.test(msg) ||
        detectedPatterns.includes('bank_impersonation') ||
        categories.includes('authority')) {
        return 'BANK_IMPERSONATION';
    }

    // Check for tech support scams
    if (/windows|virus|malware|antivirus|remote.*access|team.*viewer|remote.*support|tech.*support/i.test(msg) ||
        detectedPatterns.includes('tech_support_scam') ||
        detectedPatterns.includes('remote_access')) {
        return 'TECH_SUPPORT_SCAM';
    }

    // Check for prize/lottery scams
    if (/prize|lottery|won.*rupees|congratulations.*won|claim.*reward|free.*money|winnings|lucky/i.test(msg) ||
        detectedPatterns.includes('prize_scam') ||
        categories.includes('reward')) {
        return 'PRIZE_SCAM';
    }

    // Check for legal threat scams
    if (/police|arrest|legal.*action|court|judge|case.*filed|crime|lawsuit|penalty|fine|offense/i.test(msg) ||
        detectedPatterns.includes('legal_threat') ||
        detectedPatterns.includes('police_threat')) {
        return 'LEGAL_THREAT_SCAM';
    }

    // Check for emergency/friend in distress
    if (/help me|urgent help|friend|family|brother|sister|cousin|parent|son|daughter|emergency|accident|hospital/i.test(msg) &&
        /money|transfer|send|payment|amount/i.test(msg)) {
        return 'FRIEND_IN_EMERGENCY';
    }

    // Default: if any scam detected but type unclear
    return 'UNKNOWN_SCAM';
}

/**
 * Apply Confidence Decay Protection
 * Once high confidence is reached, lock it to prevent flip-flopping
 * @param {number} currentConfidence - Current detection confidence (0-1)
 * @param {number} previousConfidence - Previous confidence
 * @param {boolean} wasLocked - Was confidence previously locked
 * @returns {Object} - { confidence: number, isLocked: boolean }
 */
function applyConfidenceDecayProtection(currentConfidence = 0, previousConfidence = 0, wasLocked = false) {
    // If confidence was already locked above 60%, keep it locked
    if (wasLocked && previousConfidence >= 0.6) {
        return {
            confidence: Math.max(currentConfidence, previousConfidence),
            isLocked: true,
            reason: 'Confidence locked - cannot decay'
        };
    }

    // If confidence is now high, lock it
    if (currentConfidence >= 0.6) {
        return {
            confidence: currentConfidence,
            isLocked: true,
            reason: 'High confidence locked'
        };
    }

    // Normal confidence update
    return {
        confidence: currentConfidence,
        isLocked: false,
        reason: 'Confidence unlocked'
    };
}

/**
 * Handle User Claims of Legitimacy
 * User saying "This is my real bank" or "This is legitimate"
 * @param {string} message - User's message
 * @param {number} currentConfidence - Current scam confidence
 * @returns {Object} - { userClaimedLegitimate: boolean, adjustedConfidence: number }
 */
function handleUserLegitimacyClaim(message = '', currentConfidence = 0) {
    const claimPatterns = [
        /this.*real|this.*genuine|this.*legitimate|this.*true/i,
        /my.*real.*bank|my.*genuine.*bank/i,
        /i know.*person|i trust.*person|they are legitimate/i,
        /my account|my.*bank|my.*number/i
    ];

    const claimedLegitimate = claimPatterns.some(pattern => pattern.test(message));

    if (!claimedLegitimate) {
        return {
            userClaimedLegitimate: false,
            adjustedConfidence: currentConfidence,
            reason: 'No legitimacy claim detected'
        };
    }

    // User claims legitimacy - reduce confidence slightly but maintain safety threshold
    // Never go below 30% if scam was detected (realism without naivety)
    let adjustedConfidence = currentConfidence * 0.75; // 25% reduction

    if (currentConfidence > 0.15) {
        adjustedConfidence = Math.max(adjustedConfidence, 0.3); // Minimum 30% for detected scams
    }

    return {
        userClaimedLegitimate: true,
        adjustedConfidence,
        reason: 'User claimed legitimacy - confidence reduced but maintained safety threshold',
        reduction: ((currentConfidence - adjustedConfidence) * 100).toFixed(1) + '%'
    };
}

/**
 * Get Phase-based Agent Behavior Configuration
 * Controls agent responses based on conversation phase
 * @param {string} phase - Conversation phase: 'early', 'mid', 'late', 'final'
 * @returns {Object} - Configuration for agent behavior
 */
function getPhaseBasedBehavior(phase = 'early') {
    const behaviors = {
        'early': {
            allowQuestions: true,
            allowEngagement: true,
            tone: 'curious',
            baitAllowed: true,
            description: 'Early engagement - ask questions, gather info'
        },
        'mid': {
            allowQuestions: true,
            allowEngagement: true,
            tone: 'cautious',
            baitAllowed: true,
            description: 'Mid-phase - continue engagement with caution'
        },
        'late': {
            allowQuestions: false,  // FREEZE MODE: No more questions
            allowEngagement: true,
            tone: 'refusal',
            baitAllowed: false,
            response: 'REFUSE_AND_ADVISE_ONLY',
            description: 'Late phase - FREEZE QUESTIONS, only refuse and advise'
        },
        'final': {
            allowQuestions: false,
            allowEngagement: false,
            tone: 'refusal',
            baitAllowed: false,
            response: 'REFUSE_ONLY',
            description: 'Final phase - refuse further engagement'
        }
    };

    return behaviors[phase] || behaviors['early'];
}

/**
 * Identify Target Asset
 * What is the scammer trying to steal?
 * @param {string} message - The analyzed message
 * @returns {string} - The target asset (OTP, UPI_PAYMENT, etc.)
 */
function identifyTargetAsset(message = '') {
    const msg = message.toLowerCase();

    // 1. High Priority: Direct Financial/Security Credentials
    if (/otp|one.*time.*password|pin|cvv|passcode|secret.*code/i.test(msg)) {
        return 'OTP';
    }
    if (/upi|vpa|gpay|phonepe|paytm|bhim/i.test(msg)) {
        return 'UPI_PAYMENT';
    }
    if (/password|login|credentials|user.*id/i.test(msg)) {
        return 'PASSWORD';
    }
    if (/credit.*card|debit.*card|card.*number|expiry|valid.*thru/i.test(msg)) {
        return 'CREDIT_CARD';
    }

    // 2. Medium Priority: Account & Money
    if (/bank.*account|account.*number|ifsc|beneficiary/i.test(msg)) {
        return 'BANK_ACCOUNT';
    }
    if (/qr.*code|scan.*code/i.test(msg)) {
        return 'QR_CODE';
    }
    if (/money|amount|cash|transfer|payment|fund/i.test(msg)) {
        return 'MONEY';
    }

    // 3. Low Priority: Device & Info
    if (/app|apk|software|install|download|team.*viewer|any.*desk/i.test(msg)) {
        return 'DEVICE_ACCESS';
    }
    if (/aadhaar|pan|id.*proof|kyc|document/i.test(msg)) {
        return 'PERSONAL_INFO';
    }

    return null; // No specific asset identified
}

module.exports = {
    generateReasoningLayer,
    generateSafetyAdvice,
    calculatePressureVelocity,
    detectUserVulnerability,
    classifyScamArchetype,
    applyConfidenceDecayProtection,
    handleUserLegitimacyClaim,
    getPhaseBasedBehavior,
    identifyTargetAsset
};
