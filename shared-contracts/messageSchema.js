// shared-contracts/messageSchema.js

/**
 * Message schemas for API contracts
 */

/**
 * Incoming message schema
 */
const IncomingMessageSchema = {
    sessionId: 'string (required)',
    message: 'string (required)',
    platform: 'string (optional)',
    sender: 'string (optional)'
};

/**
 * Outgoing response schema
 */
const ResponseSchema = {
    sessionId: 'string',
    reply: 'string',
    isScam: 'boolean',
    confidence: 'number (0-1)',
    engagementPhase: 'string (early|mid|late|final)',
    status: 'string (active|terminated|blocked)'
};

/**
 * Validate incoming message
 * @param {Object} data - Message data to validate
 * @returns {Object} - Validation result
 */
function validateIncomingMessage(data) {
    const errors = [];

    if (!data.sessionId || typeof data.sessionId !== 'string') {
        errors.push('sessionId is required and must be a string');
    }

    if (!data.message || typeof data.message !== 'string') {
        errors.push('message is required and must be a string');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    IncomingMessageSchema,
    ResponseSchema,
    validateIncomingMessage
};
