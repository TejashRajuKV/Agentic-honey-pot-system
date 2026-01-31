// src/models/ConversationTurn.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const turnSchema = new Schema({
    sessionId: { type: String, required: true },
    turnIndex: { type: Number, required: true }, // 0, 1, 2...
    role: { type: String, enum: ["user", "agent"], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    detectedScamIntent: { type: Boolean, default: false },
    extractedIntel: {
        upiIds: [String],
        phoneNumbers: [String],
        urls: [String],
        scamPhrases: [String],
        behavioralPatterns: [String]
    }
});

module.exports = mongoose.model("ConversationTurn", turnSchema);
