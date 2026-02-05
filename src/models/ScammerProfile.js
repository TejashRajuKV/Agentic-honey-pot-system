// src/models/ScammerProfile.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Scammer behavioral profiling model
 * Creates psychological and behavioral profiles of threat actors
 */
const scammerProfileSchema = new Schema({
    profileId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Primary identifiers extracted from conversations
    identifiers: {
        upiIds: [{ type: String, index: true }],
        phoneNumbers: [{ type: String, index: true }],
        urls: [{ type: String }],
        emailAddresses: [{ type: String }]
    },

    // Behavioral fingerprint
    behavioralFingerprint: {
        // Language patterns and signature phrases
        languagePatterns: [String],
        signaturePhrases: [String],

        // Communication metrics
        avgMessageLength: { type: Number, default: 0 },
        avgResponseTime: { type: Number, default: 0 },
        messageFrequency: { type: Number, default: 0 },

        // Temporal patterns
        timePatterns: {
            activeHours: [Number], // Hours of day (0-23)
            activeDays: [Number],  // Days of week (0-6)
            timezone: String
        },

        // Emotion signature (how they manipulate)
        emotionSignature: {
            primaryEmotion: String, // fear, urgency, greed, authority
            emotionSequence: [String],
            intensityProgression: [Number]
        },

        // Pressure tactics used
        pressureTactics: [String],
        pressureVelocity: { type: String, default: 'medium' }
    },

    // Psychological profile
    psychologicalProfile: {
        primaryTactic: {
            type: String,
            enum: ['authority', 'urgency', 'fear', 'greed', 'sympathy', 'trust', 'confusion'],
            default: 'urgency'
        },

        sophistication: {
            type: String,
            enum: ['low', 'medium', 'high', 'expert'],
            default: 'medium'
        },

        // How well they adapt to victim responses
        adaptability: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // How persistent they are
        persistenceScore: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // Social engineering techniques
        manipulationTechniques: [String]
    },

    // Associated sessions and intelligence
    sessions: [{
        sessionId: String,
        date: Date,
        confidence: Number
    }],

    // Cross-session intelligence
    intelligence: {
        totalVictimAttempts: { type: Number, default: 0 },
        successRate: { type: Number, default: 0 },
        averageEngagementLength: { type: Number, default: 0 },
        targetDemographics: [String]
    },

    // Risk assessment
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
    },

    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },

    // Status and tracking
    status: {
        type: String,
        enum: ['active', 'dormant', 'blacklisted'],
        default: 'active'
    },

    // Timestamps
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },

    // Notes and tags
    tags: [String],
    notes: String
});

// Compound indexes for efficient queries
scammerProfileSchema.index({ 'identifiers.upiIds': 1 });
scammerProfileSchema.index({ 'identifiers.phoneNumbers': 1 });
scammerProfileSchema.index({ riskScore: -1 });
scammerProfileSchema.index({ lastSeen: -1 });

// Update timestamp on save
scammerProfileSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("ScammerProfile", scammerProfileSchema);
