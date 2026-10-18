// src/models/Incident.js
// One incident = everything the honeypot saw from the same scammer infrastructure. Many alert triggers
// across many sessions collapse into a single incident, which is what stops alert fatigue.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const incidentSchema = new Schema({
    incidentId: { type: String, required: true, unique: true },
    key: { type: String, required: true, unique: true },       // primary identifier (UPI / phone) or the session id
    title: String,
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
    scamType: String,
    sessionIds: [String],
    identifiers: { upiIds: [String], phoneNumbers: [String], urls: [String] },
    eventTypes: { type: Map, of: Number, default: {} },        // e.g. { critical_risk: 3, high_velocity: 1 }
    eventCount: { type: Number, default: 0 },
    alertsSent: { type: Number, default: 0 },
    alertsSuppressed: { type: Number, default: 0 },
    maxRisk: { type: Number, default: 0 },
    firstEventAt: { type: Date, default: Date.now },
    lastEventAt: { type: Date, default: Date.now },
});

incidentSchema.index({ lastEventAt: -1 });

module.exports = mongoose.model("Incident", incidentSchema);
