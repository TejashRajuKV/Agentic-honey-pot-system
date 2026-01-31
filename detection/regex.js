// detection/regex.js

/**
 * Regular expression patterns for intelligence extraction
 */

module.exports = {
    // UPI ID pattern
    UPI_PATTERN: /\b[\w\.\-]+@[\w]+\b/g,

    // Phone number patterns
    PHONE_PATTERNS: {
        INDIAN_10_DIGIT: /\b[6-9]\d{9}\b/g,
        WITH_PLUS_91: /\b\+91[6-9]\d{9}\b/g,
        WITH_91_PREFIX: /\b91[6-9]\d{9}\b/g,
        SPLIT_FORMAT: /\b\d{5}\s?\d{5}\b/g
    },

    // URL patterns
    URL_PATTERN: /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-z0-9-]+\.(com|in|org|net|info|xyz|tk|ml|ga|cf|gq)\/[^\s]*)/gi
};
