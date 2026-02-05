// src/models/Session.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const sessionSchema = new Schema({
    sessionId: { type: String, required: true, unique: true },
    platform: String,
    sender: String,
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    status: {        // "active", "terminated", "blocked"
        type: String,
        enum: ["active", "terminated", "blocked"],
        default: "active"
    },
    isScam: { type: Boolean, default: null },
    engagementPhase: { // "early", "mid", "late", "final"
        type: String,
        enum: ["early", "mid", "late", "final"],
        default: "early"
    },
    finalCallbackSent: { type: Boolean, default: false },
    // Level 5 Bait Strategy tracking
    lastBaitType: { type: String, default: null },
    baitUsedCount: { type: Number, default: 0 },
    evasionScore: { type: Number, default: 0 },
    triggeredReveal: { type: Boolean, default: false },
    // Emotion Handling Layer
    currentEmotion: {
        type: String,
        enum: ['neutral', 'confused', 'fear', 'urgent', 'angry', 'excited', 'trusting', 'hesitant'],
        default: 'neutral'
    },
    emotionHistory: {
        type: [String],
        default: []
    },
    emotionIntensity: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },
    // Persona system
    persona: { type: Object, default: null },

    // ========================================================================
    // RESPONSE GOVERNOR STATE (MONOTONIC - NEVER REGRESSES)
    // ========================================================================

    // Peak risk ever detected in this session (can only increase)
    peakRisk: {
        type: Number,
        default: 0,
        min: 0,
        max: 1
    },

    // ========================================================================
    // RISK ACCUMULATION STATE (MONOTONIC - NEVER DECREASES)
    // ========================================================================

    // Once true, ALWAYS true for entire session
    scamEverDetected: {
        type: Boolean,
        default: false
    },

    // Maximum probability ever seen (can only increase)
    maxScamProbability: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },

    // Highest phase ever reached (can only progress forward)
    // Phase order: early(0) → mid(1) → late(2) → final(3)
    highestPhase: {
        type: String,
        enum: ['early', 'mid', 'late', 'final'],
        default: 'early'
    },

    // Current response mode (one-way: NORMAL → DEFENSIVE → BLOCKING → TERMINATE)
    responseMode: {
        type: String,
        enum: ['NORMAL', 'DEFENSIVE', 'BLOCKING', 'TERMINATE'],
        default: 'NORMAL'
    },

    // Timestamp when mode was locked (for audit trail)
    responseModeLockedAt: {
        type: Date,
        default: null
    },
    // FSM State tracking
    fsmState: {
        type: String,
        enum: ['SAFE', 'SUSPICIOUS', 'HIGH_RISK', 'CONFIRMED_SCAM', 'TERMINATED'],
        default: 'SAFE'
    },
    fsmScenario: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model("Session", sessionSchema);
