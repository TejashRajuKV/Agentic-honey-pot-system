const mongoose = require("mongoose");
const { Schema } = mongoose;

const evidenceSchema = new Schema({
    type: { type: String, enum: ["session", "indicator", "timeline_event", "note", "report"], required: true },
    reference: { type: String, required: true, maxlength: 500 },
    label: { type: String, maxlength: 200, default: "" },
    contentHash: { type: String, match: /^[a-f0-9]{64}$/i },
    addedBy: { type: String, maxlength: 120, default: "analyst" },
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const noteSchema = new Schema({
    text: { type: String, required: true, maxlength: 5000 },
    author: { type: String, maxlength: 120, default: "analyst" },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const caseSchema = new Schema({
    caseId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: ["open", "investigating", "contained", "resolved", "false_positive"], default: "open", index: true },
    severity: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM", index: true },
    assignedTo: { type: String, default: "", maxlength: 120 },
    sessionIds: { type: [String], default: [] },
    indicators: { type: [String], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    notes: { type: [noteSchema], default: [] },
    tags: { type: [String], default: [] },
    createdBy: { type: String, default: "analyst", maxlength: 120 },
    resolvedAt: { type: Date, default: null }
}, { timestamps: true, optimisticConcurrency: true });

caseSchema.index({ status: 1, severity: -1, updatedAt: -1 });
caseSchema.index({ sessionIds: 1 });
caseSchema.index({ indicators: 1 });

module.exports = mongoose.models.InvestigationCase || mongoose.model("InvestigationCase", caseSchema);
