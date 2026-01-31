// detection/intelligenceExtractor.js

const { VALID_UPI_HANDLES } = require('./constants');
const { UPI_PATTERN, PHONE_PATTERNS, URL_PATTERN } = require('./regex');
const { SCAM_PHRASES } = require('./keywordRules');

/**
 * Intelligence Extraction Module
 * Extracts actionable intelligence from scam messages
 */

/**
 * Extract UPI IDs from text
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of UPI IDs found
 */
function extractUpiIds(text) {
    if (!text) return [];

    const matches = text.match(UPI_PATTERN) || [];

    // Filter to only valid UPI patterns
    return matches.filter(match => {
        const domain = match.split('@')[1];
        return VALID_UPI_HANDLES.some(handle =>
            domain.toLowerCase().includes(handle)
        );
    });
}

/**
 * Extract phone numbers from text
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of phone numbers found
 */
function extractPhoneNumbers(text) {
    if (!text) return [];

    const numbers = new Set();

    for (const [name, pattern] of Object.entries(PHONE_PATTERNS)) {
        const matches = text.match(pattern) || [];
        matches.forEach(match => {
            // Normalize the number
            const cleaned = match.replace(/[\s\+]/g, '');
            if (cleaned.length === 10 || cleaned.length === 12) {
                numbers.add(cleaned);
            }
        });
    }

    return Array.from(numbers);
}

/**
 * Extract URLs from text
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of URLs found
 */
function extractUrls(text) {
    if (!text) return [];

    const matches = text.match(URL_PATTERN) || [];
    return [...new Set(matches)];
}

/**
 * Extract scam-related phrases
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of scam phrases found
 */
function extractScamPhrases(text) {
    if (!text) return [];

    const foundPhrases = [];
    const lowerText = text.toLowerCase();

    for (const phrase of SCAM_PHRASES) {
        if (lowerText.includes(phrase)) {
            foundPhrases.push(phrase);
        }
    }

    return foundPhrases;
}

/**
 * Identify behavioral patterns
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of behavioral patterns detected
 */
function identifyBehavioralPatterns(text) {
    if (!text) return [];

    const patterns = [];

    // Urgency tactics
    if (/urgent|immediate|expires|last chance|act now/i.test(text)) {
        patterns.push('urgency_tactics');
    }

    // Authority impersonation
    if (/bank|rbi|government|police|officer|department/i.test(text)) {
        patterns.push('authority_impersonation');
    }

    // Information requests
    if (/send|share|provide|give|tell/i.test(text) &&
        /details|information|number|pin|otp|password/i.test(text)) {
        patterns.push('information_solicitation');
    }

    // Threatens consequences
    if (/block|freeze|suspend|close|terminate|legal action/i.test(text)) {
        patterns.push('threat_of_consequences');
    }

    // Promises rewards
    if (/win|won|prize|gift|reward|cashback|refund|bonus/i.test(text)) {
        patterns.push('reward_promise');
    }

    // External communication request
    if (/whatsapp|telegram|call|contact|message/i.test(text)) {
        patterns.push('external_communication_request');
    }

    return patterns;
}

/**
 * Extract all intelligence from text
 * @param {string} text - The text to analyze
 * @returns {Object} - Object containing all extracted intelligence
 */
function extractIntelligence(text) {
    return {
        upiIds: extractUpiIds(text),
        phoneNumbers: extractPhoneNumbers(text),
        urls: extractUrls(text),
        scamPhrases: extractScamPhrases(text),
        behavioralPatterns: identifyBehavioralPatterns(text)
    };
}

module.exports = {
    extractUpiIds,
    extractPhoneNumbers,
    extractUrls,
    extractScamPhrases,
    identifyBehavioralPatterns,
    extractIntelligence
};
