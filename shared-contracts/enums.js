// shared-contracts/enums.js

/**
 * Shared enumerations used across modules
 */

const SessionStatus = {
    ACTIVE: 'active',
    TERMINATED: 'terminated',
    BLOCKED: 'blocked'
};

const EngagementPhase = {
    EARLY: 'early',
    MID: 'mid',
    LATE: 'late',
    FINAL: 'final'
};

const MessageRole = {
    USER: 'user',
    AGENT: 'agent'
};

const ScamCategory = {
    BANKING: 'banking',
    PHISHING: 'phishing',
    FAKE_OFFERS: 'fakeOffers',
    URGENCY: 'urgency',
    CONTACT_REQUESTS: 'contactRequests'
};

module.exports = {
    SessionStatus,
    EngagementPhase,
    MessageRole,
    ScamCategory
};
