// agent/agentStateMachine.js

/**
 * Agent State Machine
 * Manages conversation phases and state transitions
 */

const AGENT_STATES = {
    SAFE: 'SAFE',
    SUSPICIOUS: 'SUSPICIOUS',
    HIGH_RISK: 'HIGH_RISK',
    CONFIRMED_SCAM: 'CONFIRMED_SCAM',
    TERMINATED: 'TERMINATED'
};

const STATE_HIERARCHY = {
    [AGENT_STATES.SAFE]: 0,
    [AGENT_STATES.SUSPICIOUS]: 1,
    [AGENT_STATES.HIGH_RISK]: 2,
    [AGENT_STATES.CONFIRMED_SCAM]: 3,
    [AGENT_STATES.TERMINATED]: 4
};

const NON_NEGOTIABLE_TRIGGERS = [
    // Phishing links — must have click/visit + link context
    { pattern: /click\s+(this|the|here|on)?\s*(link|url|below)|bit\.ly\/|tinyurl\.com|visit\s+(this|the)\s+(link|url|site)/i, state: AGENT_STATES.HIGH_RISK, scenario: 'link_request' },
    // Prize/lottery — must have won/claim + prize/reward
    { pattern: /you\s+(have\s+)?won\b|lottery\s+winner|lucky\s+(winner|draw)|claim\s+(your\s+)?(prize|reward|cash|money)/i, state: AGENT_STATES.HIGH_RISK, scenario: 'reward' },
    // OTP — must explicitly request the code
    { pattern: /share\s+(the\s+)?(otp|code|pin\b)|send\s+(me\s+)?(the\s+)?(otp|pin\b|verification\s+code)|tell\s+(me\s+)?(your\s+)?(otp|code)/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'otp_request' },
    // Payment — must ask for money transfer or UPI
    { pattern: /send\s+(money|funds|₹|rs\.?\s*\d)|transfer\s+(the\s+)?(amount|money|funds)|pay\s+(₹|rs\.?\s*\d|now\s+to)|share\s+(your\s+)?upi\s+(id|number)/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'payment_request' },
    // Legal threats — specific legal consequences
    { pattern: /legal\s+action\s+(will|has)\s+be|you\s+(will\s+be|are\s+being)\s+arrested|court\s+(notice|summon)|warrant\s+(issued|against)/i, state: AGENT_STATES.HIGH_RISK, scenario: 'threat' },
    // Authority + account action together
    { pattern: /(rbi|reserve\s+bank|income\s+tax|cbi|enforcement\s+directorate).{0,50}(account|kyc|verify|block|action|notice)/i, state: AGENT_STATES.SUSPICIOUS, scenario: 'authority_claim' },
    // Account urgency — needs BOTH account threat AND time pressure
    { pattern: /(account|kyc|bank\s+account).{0,40}(block|frozen|suspend|deactivat).{0,40}(immediately|urgent|within\s+\d|in\s+\d+\s+minutes)/i, state: AGENT_STATES.HIGH_RISK, scenario: 'urgency_threat' },
    // Explicit verbal abuse only
    { pattern: /\b(stupid|idiot|moron|useless\s+bot)\b|shut\s+up|waste\s+of\s+(my\s+)?time/i, state: AGENT_STATES.TERMINATED, scenario: 'abuse' }
];

/**
 * Update Agent State based on user message and detection results
 */
function updateAgentState(currentMessage, detectionResults, currentState = AGENT_STATES.SAFE) {
    let nextState = currentState;

    // Check non-negotiable triggers first
    for (const trigger of NON_NEGOTIABLE_TRIGGERS) {
        if (trigger.pattern.test(currentMessage)) {
            if (STATE_HIERARCHY[trigger.state] > STATE_HIERARCHY[nextState]) {
                nextState = trigger.state;
                return { state: nextState, scenario: trigger.scenario };
            }
        }
    }

    // Fallback to confidence-based state if no triggers hit
    // Raised thresholds to align with governor (honeypot should engage first)
    const confidence = detectionResults.confidence || 0;
    if (confidence > 0.85 && STATE_HIERARCHY[AGENT_STATES.CONFIRMED_SCAM] > STATE_HIERARCHY[nextState]) {
        nextState = AGENT_STATES.CONFIRMED_SCAM;
    } else if (confidence > 0.65 && STATE_HIERARCHY[AGENT_STATES.HIGH_RISK] > STATE_HIERARCHY[nextState]) {
        nextState = AGENT_STATES.HIGH_RISK;
    } else if (confidence > 0.40 && STATE_HIERARCHY[AGENT_STATES.SUSPICIOUS] > STATE_HIERARCHY[nextState]) {
        nextState = AGENT_STATES.SUSPICIOUS;
    }

    return { state: nextState, scenario: null };
}

/**
 * Get conversation phase based on turn count
 */
function getConversationPhase(turnCount) {
    if (turnCount <= 2) return 'early';
    if (turnCount <= 5) return 'mid';
    if (turnCount <= 8) return 'late';
    return 'final';
}

/**
 * Determine if conversation should be wrapped up
 * @param {number} turnCount - Number of conversation turns
 * @param {Object} extractedIntel - Intelligence gathered so far
 * @returns {boolean} - Whether to wrap up the conversation
 */
function shouldWrapUp(turnCount, extractedIntel) {
    // Wrap up after sufficient turns
    if (turnCount >= 10) return true;

    // Wrap up if we've extracted significant intelligence
    const hasIntel = (
        (extractedIntel.upiIds && extractedIntel.upiIds.length > 0) ||
        (extractedIntel.phoneNumbers && extractedIntel.phoneNumbers.length > 0) ||
        (extractedIntel.urls && extractedIntel.urls.length > 1)
    );

    if (hasIntel && turnCount >= 6) return true;

    return false;
}

/**
 * Determine next engagement strategy
 */
function getEngagementStrategy(phase, categories) {
    const strategies = {
        early: {
            banking: 'show_concern',
            phishing: 'show_interest',
            fakeOffers: 'show_curiosity',
            default: 'ask_clarification'
        },
        mid: {
            banking: 'express_worry',
            phishing: 'show_hesitation',
            fakeOffers: 'request_details',
            default: 'hesitate_and_verify'
        },
        late: {
            banking: 'refuse_clearly',
            phishing: 'refuse_clearly',
            fakeOffers: 'refuse_clearly',
            default: 'refuse_clearly'
        },
        final: {
            default: 'provide_safety_advice'
        }
    };

    const category = categories[0] || 'default';
    return strategies[phase]?.[category] || strategies[phase]?.default || 'refuse_clearly';
}

module.exports = {
    AGENT_STATES,
    updateAgentState,
    getConversationPhase,
    shouldWrapUp,
    getEngagementStrategy
};

