// src/models/ScammerIntelligence.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Cross-Session Intelligence Database
 * Tracks known scammers across multiple sessions
 */
const scammerIntelSchema = new Schema({
    // Identifying information
    upiId: { type: String, index: true },
    phoneNumber: { type: String, index: true },

    // Tracking metrics
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    sessionCount: { type: Number, default: 1 },

    // Intelligence summary
    scamTypes: [String], // List of scam types detected
    averageConfidence: { type: Number, default: 0 },
    riskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },

    // Associated sessions
    sessions: [{ type: String }], // Session IDs

    // Behavioral patterns
    commonPhrases: [String],
    urgencyScore: { type: Number, default: 0 },
    evasionScore: { type: Number, default: 0 },

    // Status
    isBlacklisted: { type: Boolean, default: false },
    notes: String
});

// Create compound index for efficient lookups
scammerIntelSchema.index({ upiId: 1, phoneNumber: 1 });

module.exports = mongoose.model("ScammerIntelligence", scammerIntelSchema);
