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
    { pattern: /click.*link|visit.*url|bit\.ly|t\.co/i, state: AGENT_STATES.HIGH_RISK, scenario: 'link_request' },
    { pattern: /won.*prize|reward.*5000|lottery|winner|crore|lakh/i, state: AGENT_STATES.HIGH_RISK, scenario: 'reward' },
    { pattern: /otp.*request|send.*code|tell.*otp|verification.*code/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'otp_request' },
    { pattern: /payment.*request|send.*money|transfer.*amount|pay.*₹|upi.*id/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'payment_request' },
    { pattern: /threat|legal.*action|police|arrest|court|jail|case/i, state: AGENT_STATES.HIGH_RISK, scenario: 'threat' },
    { pattern: /blocked|frozen|suspended|deactivated|within.*minutes|immediately|urgent|now|deadline/i, state: AGENT_STATES.HIGH_RISK, scenario: 'urgency_threat' },
    { pattern: /bank|rbi|income.*tax|cbi|police.*department/i, state: AGENT_STATES.SUSPICIOUS, scenario: 'authority_claim' },
    { pattern: /stupid|idiot|waste.*time|useless|abuse/i, state: AGENT_STATES.TERMINATED, scenario: 'abuse' }
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

    // fallback to confidence-based state if no triggers hit
    const confidence = detectionResults.confidence || 0;
    if (confidence > 0.8 && STATE_HIERARCHY[AGENT_STATES.CONFIRMED_SCAM] > STATE_HIERARCHY[nextState]) {
        nextState = AGENT_STATES.CONFIRMED_SCAM;
    } else if (confidence > 0.4 && STATE_HIERARCHY[AGENT_STATES.HIGH_RISK] > STATE_HIERARCHY[nextState]) {
        nextState = AGENT_STATES.HIGH_RISK;
    } else if (confidence > 0.20 && STATE_HIERARCHY[AGENT_STATES.SUSPICIOUS] > STATE_HIERARCHY[nextState]) {
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

