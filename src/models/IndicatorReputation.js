const mongoose = require("mongoose");
const { Schema } = mongoose;

const indicatorReputationSchema = new Schema({
    kind: { type: String, enum: ["url", "domain", "phone", "upi", "ip", "email", "other"], required: true },
    value: { type: String, required: true, trim: true, maxlength: 2048 },
    normalizedValue: { type: String, required: true, trim: true, maxlength: 2048 },
    status: { type: String, enum: ["unknown", "suspicious", "confirmed", "benign", "expired"], default: "unknown", index: true },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    observationCount: { type: Number, min: 0, default: 1 },
    sources: { type: [String], default: [] },
    sessionIds: { type: [String], default: [] },
    firstSeenAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null, index: true },
    notes: { type: String, default: "", maxlength: 2000 }
}, { timestamps: true });

indicatorReputationSchema.index({ kind: 1, normalizedValue: 1 }, { unique: true });
indicatorReputationSchema.index({ status: 1, lastSeenAt: -1 });

module.exports = mongoose.models.IndicatorReputation || mongoose.model("IndicatorReputation", indicatorReputationSchema);
