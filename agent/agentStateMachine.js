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
    { pattern: /click.*link|visit.*url/i, state: AGENT_STATES.HIGH_RISK, scenario: 'link_request' },
    { pattern: /won.*prize|reward.*5000|lottery/i, state: AGENT_STATES.HIGH_RISK, scenario: 'reward' },
    { pattern: /otp.*request|send.*code|tell.*otp/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'otp_request' },
    { pattern: /payment.*request|send.*money|transfer.*amount/i, state: AGENT_STATES.CONFIRMED_SCAM, scenario: 'payment_request' },
    { pattern: /threat|legal.*action|police|arrest/i, state: AGENT_STATES.HIGH_RISK, scenario: 'threat' },
    { pattern: /stupid|idiot|waste.*time|useless/i, state: AGENT_STATES.TERMINATED, scenario: 'abuse' }
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
    } else if (confidence > 0.15 && STATE_HIERARCHY[AGENT_STATES.SUSPICIOUS] > STATE_HIERARCHY[nextState]) {
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
            phishing: 'show_excitement',
            fakeOffers: 'request_details',
            default: 'seek_understanding'
        },
        late: {
            banking: 'prepare_comply',
            phishing: 'ready_to_claim',
            fakeOffers: 'eager_to_proceed',
            default: 'willing_to_act'
        },
        final: {
            default: 'extract_final_details'
        }
    };

    const category = categories[0] || 'default';
    return strategies[phase]?.[category] || strategies[phase]?.default || 'neutral';
}

module.exports = {
    AGENT_STATES,
    updateAgentState,
    getConversationPhase,
    shouldWrapUp,
    getEngagementStrategy
};

