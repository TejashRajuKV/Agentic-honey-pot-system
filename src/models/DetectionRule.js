const mongoose = require("mongoose");
const { Schema } = mongoose;

const detectionRuleSchema = new Schema({
    ruleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    type: { type: String, enum: ["contains", "phrase_any", "url_present", "upi_present", "phone_present", "starts_with"], required: true },
    terms: { type: [String], default: [] },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
    status: { type: String, enum: ["draft", "enabled", "disabled"], default: "draft", index: true },
    version: { type: Number, min: 1, default: 1 },
    createdBy: { type: String, default: "analyst", maxlength: 120 },
    updatedBy: { type: String, default: "analyst", maxlength: 120 },
    lastReplayAt: { type: Date, default: null }
}, { timestamps: true });

detectionRuleSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.models.DetectionRule || mongoose.model("DetectionRule", detectionRuleSchema);
