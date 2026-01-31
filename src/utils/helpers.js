// src/utils/helpers.js

/**
 * Utility helper functions
 */

/**
 * Generate a unique session ID
 * @returns {string} - Unique session ID
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} - Whether the session ID is valid
 */
function isValidSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.length > 0;
}

/**
 * Sanitize text input
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
function sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';

    // Remove potentially dangerous characters but preserve the content
    return text.trim().substring(0, 5000); // Limit length
}

/**
 * Calculate conversation duration in seconds
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time (optional, defaults to now)
 * @returns {number} - Duration in seconds
 */
function calculateDuration(startTime, endTime = new Date()) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.floor((end - start) / 1000);
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp for logging
 * @param {Date} date - Date to format
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(date = new Date()) {
    return new Date(date).toISOString();
}

/**
 * Create error response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} - Error response object
 */
function createErrorResponse(message, statusCode = 500) {
    return {
        error: true,
        message,
        statusCode,
        timestamp: formatTimestamp()
    };
}

/**
 * Create success response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} - Success response object
 */
function createSuccessResponse(data, message = 'Success') {
    return {
        success: true,
        message,
        data,
        timestamp: formatTimestamp()
    };
}

module.exports = {
    generateSessionId,
    isValidSessionId,
    sanitizeText,
    calculateDuration,
    delay,
    formatTimestamp,
    createErrorResponse,
    createSuccessResponse
};
