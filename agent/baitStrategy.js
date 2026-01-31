// agent/baitStrategy.js

/**
 * Level 5: Honeypot-Triggered Detection (Bait Strategy)
 * Uses strategic confusion and questioning to trigger faster scam reveals
 */

/**
 * Determine if we should use bait strategy
 * @param {Object} scamContext - Detection results
 * @param {string} phase - Conversation phase
 * @param {number} turnCount - Number of conversation turns
 * @returns {boolean}
 */
function shouldUseBait(scamContext, phase, turnCount) {
    const { confidence, riskLevel } = scamContext;

    // Use bait if:
    // 1. Medium risk but not confirmed
    // 2. Early/mid phase (before agent commits)
    // 3. Low turn count (first 5 turns)

    if (riskLevel === 'MEDIUM' || riskLevel === 'LOW') {
        return turnCount < 5;
    }

    if (confidence > 0.3 && confidence < 0.7) {
        return phase === 'early' || phase === 'mid';
    }

    return false;
}

/**
 * Generate strategic bait response
 * @param {string} userMessage - Scammer's message
 * @param {Object} scamContext - Detection context
 * @param {string} phase - Conversation phase
 * @returns {Object} - Bait response and tracking
 */
function generateBaitResponse(userMessage, scamContext, phase) {
    const msg = userMessage.toLowerCase();
    const { categories = [] } = scamContext;

    // Track what bait strategy we're using
    let baitType = null;
    let response = null;

    // Strategy 1: Play confused/dumb
    if (categories.includes('banking') || /kyc|verify|account/i.test(msg)) {
        response = pickRandom([
            "I'm not sure I understand. Which account are you referring to?",
            "Can you explain this more clearly? I'm a bit confused.",
            "I don't remember signing up for anything. Are you sure you have the right person?",
            "This sounds important, but I don't quite follow. Can you clarify?"
        ]);
        baitType = 'confusion_play';
    }

    // Strategy 2: Ask for verification/proof
    else if (categories.includes('phishing') || /won|prize|lottery/i.test(msg)) {
        response = pickRandom([
            "That's interesting! Can you send me some official documentation about this?",
            "I want to make sure this is legitimate. Do you have a website I can check?",
            "How do I know this is real? Can you prove it?",
            "Which company is this from? Can I call them directly to confirm?"
        ]);
        baitType = 'verification_request';
    }

    // Strategy 3: Express hesitation about actions
    else if (/send|pay|click|otp|pin/i.test(msg)) {
        response = pickRandom([
            "I'm not comfortable sharing that. Why do you need it exactly?",
            "Before I do anything, can you explain why this is necessary?",
            "That seems unusual. Is there another way to do this?",
            "I'd like to verify this through official channels first. Can I call the bank directly?"
        ]);
        baitType = 'hesitation_express';
    }

    // Strategy 4: Question urgency
    else if (/urgent|immediate|now|quickly|hurry/i.test(msg)) {
        response = pickRandom([
            "Why is this so urgent? What happens if I wait?",
            "I need time to think about this. Can I do it later?",
            "This is making me nervous. Why the rush?",
            "Let me check with someone first. I don't want to make a mistake."
        ]);
        baitType = 'urgency_question';
    }

    // Strategy 5: Request alternative channels
    else if (categories.includes('contactRequests')) {
        response = pickRandom([
            "Can I visit the office instead? I prefer doing this in person.",
            "Is there an official email or phone number I can use?",
            "Let me contact them through their official website instead.",
            "I'll call the helpline number to confirm this first."
        ]);
        baitType = 'alternative_channel';
    }

    // Default: General confusion
    else {
        response = pickRandom([
            "I don't quite understand. Can you explain this differently?",
            "Sorry, I'm not following. What do you mean?",
            "Can you give me more details? I'm not sure what to do.",
            "This doesn't make sense to me. Can you clarify?"
        ]);
        baitType = 'general_confusion';
    }

    return {
        response,
        baitType,
        isBait: true
    };
}

/**
 * Analyze scammer's response to bait
 * @param {string} scammerResponse - Their reply to our bait
 * @param {string} previousBaitType - What bait we used
 * @returns {Object} - Behavior analysis
 */
function analyzeBaitResponse(scammerResponse, previousBaitType) {
    const msg = scammerResponse.toLowerCase();

    let evasionScore = 0;
    let urgencyPushScore = 0;
    let revealScore = 0;
    const patterns = [];

    // Check for evasive behavior
    if (previousBaitType === 'verification_request') {
        // Did they provide proof?
        if (!/website|official|document|proof/i.test(msg)) {
            evasionScore += 0.3;
            patterns.push('avoided_verification');
        }
    }

    if (previousBaitType === 'confusion_play') {
        // Did they give clear explanation?
        if (/just|simply|please|sir|do it/i.test(msg) && msg.length < 50) {
            evasionScore += 0.25;
            patterns.push('vague_explanation');
        }
    }

    // Check if they increased urgency
    const urgencyWords = ['urgent', 'immediate', 'now', 'quickly', 'fast', 'hurry', 'today'];
    const urgencyCount = urgencyWords.filter(word => msg.includes(word)).length;
    if (urgencyCount >= 2) {
        urgencyPushScore += 0.4;
        patterns.push('escalated_urgency');
    }

    // Check if they revealed more info (UPI, phone, link)
    if (/\d{10}|@[a-z]+|http|bit\.ly|tinyurl/i.test(msg)) {
        revealScore += 0.5;
        patterns.push('revealed_contact_info');
    }

    // Check for authority claims
    if (/bank|government|police|official|manager/i.test(msg)) {
        evasionScore += 0.2;
        patterns.push('authority_claim');
    }

    // Check for deflection
    if (/don't worry|trust me|no need|no problem|just do/i.test(msg)) {
        evasionScore += 0.3;
        patterns.push('deflection');
    }

    // Calculate total suspicion increase
    const totalIncrease = evasionScore + urgencyPushScore + revealScore;

    return {
        evasionScore,
        urgencyPushScore,
        revealScore,
        totalSuspicionIncrease: Math.min(totalIncrease, 1.0),
        patterns,
        triggeredReveal: revealScore > 0 || urgencyPushScore > 0.3
    };
}

/**
 * Get adaptive follow-up bait
 * @param {Object} baitAnalysis - Results from analyzing their response to previous bait
 * @param {number} turnCount - Current turn count
 * @returns {string|null} - Follow-up bait or null if done baiting
 */
function getAdaptiveFollowUp(baitAnalysis, turnCount) {
    const { evasionScore, urgencyPushScore, patterns } = baitAnalysis;

    // If they're being very evasive, press harder
    if (evasionScore > 0.4) {
        return pickRandom([
            "I'm still not clear. Can someone else help me verify this?",
            "This doesn't sound right. Let me check with my bank directly.",
            "I think I should call the official helpline first."
        ]);
    }

    // If they're pushing urgency, express more hesitation
    if (urgencyPushScore > 0.3) {
        return pickRandom([
            "Why are you rushing me? That makes me suspicious.",
            "I need more time to think. This is too fast.",
            "Let me do this tomorrow when I can verify properly."
        ]);
    }

    // If patterns detected, question them
    if (patterns.includes('authority_claim')) {
        return "Can you give me your employee ID or official badge number?";
    }

    if (patterns.includes('deflection')) {
        return "You're not answering my question. Why not?";
    }

    // Stop baiting after 3 attempts
    if (turnCount > 4) {
        return null;
    }

    return null;
}

/**
 * Pick random item from array
 */
function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

module.exports = {
    shouldUseBait,
    generateBaitResponse,
    analyzeBaitResponse,
    getAdaptiveFollowUp
};
