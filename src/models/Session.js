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
    persona: { type: Object, default: null }
});

module.exports = mongoose.model("Session", sessionSchema);
