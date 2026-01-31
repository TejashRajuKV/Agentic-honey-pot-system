// shared-contracts/intelligenceSchema.js

/**
 * Intelligence data schemas
 */

/**
 * Extracted intelligence schema
 */
const IntelligenceSchema = {
    upiIds: 'array of strings',
    phoneNumbers: 'array of strings',
    urls: 'array of strings',
    scamPhrases: 'array of strings',
    behavioralPatterns: 'array of strings'
};

/**
 * Scam detection result schema
 */
const DetectionResultSchema = {
    isScam: 'boolean',
    confidence: 'number (0-1)',
    detectedPatterns: 'array of strings',
    categories: 'array of strings',
    category: 'string or null'
};

/**
 * Create empty intelligence object
 * @returns {Object} - Empty intelligence structure
 */
function createEmptyIntelligence() {
    return {
        upiIds: [],
        phoneNumbers: [],
        urls: [],
        scamPhrases: [],
        behavioralPatterns: []
    };
}

/**
 * Merge intelligence objects
 * @param {Array} intelligenceArray - Array of intelligence objects
 * @returns {Object} - Merged intelligence
 */
function mergeIntelligence(intelligenceArray) {
    const merged = createEmptyIntelligence();

    intelligenceArray.forEach(intel => {
        if (intel.upiIds) merged.upiIds.push(...intel.upiIds);
        if (intel.phoneNumbers) merged.phoneNumbers.push(...intel.phoneNumbers);
        if (intel.urls) merged.urls.push(...intel.urls);
        if (intel.scamPhrases) merged.scamPhrases.push(...intel.scamPhrases);
        if (intel.behavioralPatterns) merged.behavioralPatterns.push(...intel.behavioralPatterns);
    });

    // Remove duplicates
    merged.upiIds = [...new Set(merged.upiIds)];
    merged.phoneNumbers = [...new Set(merged.phoneNumbers)];
    merged.urls = [...new Set(merged.urls)];
    merged.scamPhrases = [...new Set(merged.scamPhrases)];
    merged.behavioralPatterns = [...new Set(merged.behavioralPatterns)];

    return merged;
}

module.exports = {
    IntelligenceSchema,
    DetectionResultSchema,
    createEmptyIntelligence,
    mergeIntelligence
};
