// detection/constants.js

/**
 * Detection-related constants
 */

module.exports = {
    // Valid UPI handles
    VALID_UPI_HANDLES: [
        'paytm', 'phonepe', 'googlepay', 'okaxis', 'okhdfcbank',
        'okicici', 'oksbi', 'ybl', 'ibl', 'axl', 'apl'
    ],

    // Scam detection thresholds
    DETECTION_THRESHOLDS: {
        LOW: 0.3,
        MEDIUM: 0.5,
        HIGH: 0.7,
        CRITICAL: 0.9
    },

    // Scam categories
    SCAM_CATEGORIES: {
        BANKING: 'banking',
        PHISHING: 'phishing',
        FAKE_OFFERS: 'fakeOffers',
        URGENCY: 'urgency',
        CONTACT_REQUESTS: 'contactRequests'
    }
};
