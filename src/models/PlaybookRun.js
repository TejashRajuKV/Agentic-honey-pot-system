const mongoose = require("mongoose");
const { Schema } = mongoose;

const playbookRunSchema = new Schema({
    runId: { type: String, required: true, unique: true, index: true },
    playbook: { type: String, enum: ["create_case", "record_indicator"], required: true },
    status: { type: String, enum: ["succeeded", "failed"], required: true },
    approvedBy: { type: String, required: true, maxlength: 120 },
    approvalReason: { type: String, required: true, maxlength: 1000 },
    requestId: { type: String, required: true, unique: true, maxlength: 120 },
    resultReference: { type: String, default: "", maxlength: 300 },
    safeSummary: { type: String, default: "", maxlength: 1000 }
}, { timestamps: true });

playbookRunSchema.index({ createdAt: -1 });

module.exports = mongoose.models.PlaybookRun || mongoose.model("PlaybookRun", playbookRunSchema);
