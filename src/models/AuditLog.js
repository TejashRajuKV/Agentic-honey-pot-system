// src/models/AuditLog.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Enhanced Audit Log
 * Full tracking of all honeypot interactions
 */
const auditLogSchema = new Schema({
    sessionId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },

    // Event type
    eventType: {
        type: String,
        enum: [
            'SESSION_START',
            'MESSAGE_RECEIVED',
            'SCAM_DETECTED',
            'AGENT_RESPONSE',
            'BAIT_DEPLOYED',
            'INTELLIGENCE_EXTRACTED',
            'REPEAT_SCAMMER_DETECTED',
            'SESSION_TERMINATED',
            'CALLBACK_SENT'
        ],
        required: true
    },

    // Message content (if applicable)
    incomingMessage: String,
    outgoingMessage: String,

    // Detection results
    detection: {
        isScam: Boolean,
        confidence: Number,
        riskLevel: String,
        categories: [String],
        detectedPatterns: [String]
    },

    // Intelligence extracted
    intelligence: {
        upiIds: [String],
        phoneNumbers: [String],
        urls: [String],
        scamPhrases: [String]
    },

    // Agent state
    agentState: {
        phase: String,
        persona: String,
        baitType: String,
        turnCount: Number
    },

    // Cross-session correlation
    knownScammer: {
        isKnown: Boolean,
        previousSessions: Number,
        riskLevel: String
    },

    // Metadata
    platform: String,
    sender: String,

    // Additional context
    notes: String
});

// Compound index for efficient querying
auditLogSchema.index({ sessionId: 1, timestamp: 1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
