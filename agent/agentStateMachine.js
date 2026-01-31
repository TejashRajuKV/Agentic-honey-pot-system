// agent/agentStateMachine.js

/**
 * Agent State Machine
 * Manages conversation phases and state transitions
 */

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
    getConversationPhase,
    shouldWrapUp,
    getEngagementStrategy
};
