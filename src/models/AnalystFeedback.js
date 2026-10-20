const mongoose = require("mongoose");
const { Schema } = mongoose;

const analystFeedbackSchema = new Schema({
    sessionId: { type: String, required: true, trim: true, maxlength: 200, index: true },
    label: { type: String, enum: ["true_positive", "false_positive", "uncertain", "missed_detection"], required: true, index: true },
    analyst: { type: String, default: "analyst", maxlength: 120 },
    note: { type: String, default: "", maxlength: 3000 },
    modelVersion: { type: String, default: "", maxlength: 100 },
    confidenceAtReview: { type: Number, min: 0, max: 1 },
    reviewedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

analystFeedbackSchema.index({ sessionId: 1, reviewedAt: -1 });

module.exports = mongoose.models.AnalystFeedback || mongoose.model("AnalystFeedback", analystFeedbackSchema);
