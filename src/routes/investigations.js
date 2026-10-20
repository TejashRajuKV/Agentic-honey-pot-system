const express = require("express");
const crypto = require("crypto");
const { domainToASCII } = require("url");
const router = express.Router();
const InvestigationCase = require("../models/InvestigationCase");
const AnalystFeedback = require("../models/AnalystFeedback");
const IndicatorReputation = require("../models/IndicatorReputation");
const ConversationTurn = require("../models/ConversationTurn");
const AuditLog = require("../models/AuditLog");

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CASE_STATUSES = ["open", "investigating", "contained", "resolved", "false_positive"];
const FEEDBACK_LABELS = ["true_positive", "false_positive", "uncertain", "missed_detection"];

function boundedString(value, max, { required = false } = {}) {
    if (typeof value !== "string") return null;
    const clean = value.trim();
    if ((required && !clean) || clean.length > max) return null;
    return clean;
}
function boundedStringArray(value, maxItems = 100, maxLength = 300) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maxItems) return null;
    const result = [];
    for (const item of value) {
        const clean = boundedString(item, maxLength, { required: true });
        if (clean === null) return null;
        if (!result.includes(clean)) result.push(clean);
    }
    return result;
}
function boundedLimit(value, fallback = 50, max = 200) {
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : null;
}
function normalizeIndicator(kind, value) {
    if (kind === "url" || kind === "domain") {
        if (kind === "domain") {
            const ascii = domainToASCII(value.toLowerCase().replace(/\.$/, ""));
            return ascii || null;
        }
        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
            url.hash = "";
            return url.toString().toLowerCase();
        } catch { return null; }
    }
    return value.trim().toLowerCase();
}

/**
 * Static URL triage only. It deliberately does not fetch, resolve, preview, or open the URL,
 * preventing SSRF and accidental contact with attacker-controlled infrastructure.
 */
function analyzeUrl(raw) {
    const value = boundedString(raw, 2048, { required: true });
    if (!value) return { valid: false, error: "url must be a non-empty string of at most 2048 characters" };
    let url;
    try { url = new URL(value); } catch { return { valid: false, error: "url must be an absolute URL" }; }
    if (!["http:", "https:"].includes(url.protocol)) return { valid: false, error: "only HTTP and HTTPS URLs can be analyzed" };
    if (url.username || url.password) return { valid: false, error: "URLs containing embedded credentials are not accepted" };
    const hostname = domainToASCII(url.hostname.toLowerCase()).replace(/\.$/, "");
    if (!hostname) return { valid: false, error: "URL hostname is invalid" };
    const reasons = [];
    const hostIsIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
    if (hostIsIp) reasons.push("literal_ip_host");
    if (hostname.startsWith("xn--") || hostname.split(".").some((part) => part.startsWith("xn--"))) reasons.push("internationalized_domain");
    if (hostname.split(".").length >= 5) reasons.push("many_subdomains");
    if (hostname.includes("localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) reasons.push("local_or_internal_hostname");
    if (url.protocol === "http:") reasons.push("unencrypted_http");
    if (url.port && !["80", "443"].includes(url.port)) reasons.push("nonstandard_port");
    if (url.href.length > 500) reasons.push("long_url");
    if (url.search.length > 180) reasons.push("long_query_string");
    if (/%25|%2f|%5c|%40/i.test(url.href)) reasons.push("encoded_delimiters");
    if (/(login|verify|secure|account|wallet|payment|otp|password|support|update)/i.test(url.hostname)) reasons.push("sensitive_term_in_hostname");
    if (/(\.zip|\.mov|\.click|\.top|\.work|\.gq|\.tk)$/i.test(hostname)) reasons.push("higher_abuse_tld_signal");
    const uniqueReasons = [...new Set(reasons)];
    const score = Math.min(100, uniqueReasons.reduce((sum, reason) => sum + ({
        literal_ip_host: 25, local_or_internal_hostname: 30, internationalized_domain: 15,
        many_subdomains: 10, unencrypted_http: 8, nonstandard_port: 10, long_url: 8,
        long_query_string: 8, encoded_delimiters: 12, sensitive_term_in_hostname: 12,
        higher_abuse_tld_signal: 12
    }[reason] || 5), 0));
    return {
        valid: true,
        data: {
            normalizedUrl: url.toString(),
            hostname,
            protocol: url.protocol.slice(0, -1),
            port: url.port || (url.protocol === "https:" ? "443" : "80"),
            pathLength: url.pathname.length,
            queryParameterCount: [...url.searchParams.keys()].length,
            hasFragment: Boolean(url.hash),
            signals: uniqueReasons,
            heuristicScore: score,
            assessment: score >= 40 ? "high_review_priority" : score >= 15 ? "review" : "no_obvious_static_signals",
            disclaimer: "Static heuristics only; this is not a verdict or reputation lookup. The URL was not contacted."
        }
    };
}

router.get("/cases", async (req, res) => {
    try {
        const limit = boundedLimit(req.query.limit);
        if (limit === null) return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
        const filter = {};
        if (req.query.status !== undefined) {
            if (!CASE_STATUSES.includes(req.query.status)) return res.status(400).json({ status: "error", message: "Unsupported case status" });
            filter.status = req.query.status;
        }
        if (req.query.severity !== undefined) {
            if (!SEVERITIES.includes(req.query.severity)) return res.status(400).json({ status: "error", message: "Unsupported severity" });
            filter.severity = req.query.severity;
        }
        const cases = await InvestigationCase.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
        res.json({ status: "success", count: cases.length, data: cases });
    } catch { res.status(500).json({ status: "error", message: "Unable to load cases" }); }
});

router.post("/cases", async (req, res) => {
    const title = boundedString(req.body?.title, 200, { required: true });
    const summary = req.body?.summary === undefined ? "" : boundedString(req.body.summary, 5000);
    const sessionIds = boundedStringArray(req.body?.sessionIds, 100, 200);
    const indicators = boundedStringArray(req.body?.indicators, 100, 2048);
    const tags = boundedStringArray(req.body?.tags, 30, 50);
    const severity = req.body?.severity === undefined ? "MEDIUM" : req.body.severity;
    const createdBy = req.body?.createdBy === undefined ? "analyst" : boundedString(req.body.createdBy, 120);
    if (!title || summary === null || !sessionIds || !indicators || !tags || !createdBy || !SEVERITIES.includes(severity)) {
        return res.status(400).json({ status: "error", message: "Invalid case fields or field limits exceeded" });
    }
    try {
        const created = await InvestigationCase.create({
            caseId: `CASE-${crypto.randomUUID()}`, title, summary, severity, sessionIds, indicators, tags, createdBy
        });
        res.status(201).json({ status: "success", data: created });
    } catch { res.status(500).json({ status: "error", message: "Unable to create case" }); }
});

router.get("/cases/:caseId", async (req, res) => {
    const caseId = boundedString(req.params.caseId, 100, { required: true });
    if (!caseId || /[\\/\0-\x1f\x7f]/.test(caseId)) return res.status(400).json({ status: "error", message: "Invalid case ID" });
    try {
        const item = await InvestigationCase.findOne({ caseId }).lean();
        if (!item) return res.status(404).json({ status: "error", message: "Case not found" });
        res.json({ status: "success", data: item });
    } catch { res.status(500).json({ status: "error", message: "Unable to load case" }); }
});

router.patch("/cases/:caseId", async (req, res) => {
    const caseId = boundedString(req.params.caseId, 100, { required: true });
    if (!caseId || /[\\/\0-\x1f\x7f]/.test(caseId)) return res.status(400).json({ status: "error", message: "Invalid case ID" });
    const allowed = {};
    if (req.body?.title !== undefined) {
        allowed.title = boundedString(req.body.title, 200, { required: true });
        if (!allowed.title) return res.status(400).json({ status: "error", message: "Invalid title" });
    }
    if (req.body?.summary !== undefined) {
        allowed.summary = boundedString(req.body.summary, 5000);
        if (allowed.summary === null) return res.status(400).json({ status: "error", message: "Invalid summary" });
    }
    if (req.body?.assignedTo !== undefined) {
        allowed.assignedTo = boundedString(req.body.assignedTo, 120);
        if (allowed.assignedTo === null) return res.status(400).json({ status: "error", message: "Invalid assignee" });
    }
    if (req.body?.status !== undefined) {
        if (!CASE_STATUSES.includes(req.body.status)) return res.status(400).json({ status: "error", message: "Unsupported case status" });
        allowed.status = req.body.status;
        allowed.resolvedAt = ["resolved", "false_positive"].includes(req.body.status) ? new Date() : null;
    }
    if (req.body?.severity !== undefined) {
        if (!SEVERITIES.includes(req.body.severity)) return res.status(400).json({ status: "error", message: "Unsupported severity" });
        allowed.severity = req.body.severity;
    }
    if (req.body?.sessionIds !== undefined) {
        allowed.sessionIds = boundedStringArray(req.body.sessionIds, 100, 200);
        if (!allowed.sessionIds) return res.status(400).json({ status: "error", message: "Invalid sessionIds" });
    }
    if (req.body?.indicators !== undefined) {
        allowed.indicators = boundedStringArray(req.body.indicators, 100, 2048);
        if (!allowed.indicators) return res.status(400).json({ status: "error", message: "Invalid indicators" });
    }
    if (!Object.keys(allowed).length) return res.status(400).json({ status: "error", message: "No supported fields supplied" });
    try {
        const updated = await InvestigationCase.findOneAndUpdate({ caseId }, { $set: allowed }, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ status: "error", message: "Case not found" });
        res.json({ status: "success", data: updated });
    } catch { res.status(500).json({ status: "error", message: "Unable to update case" }); }
});

router.post("/cases/:caseId/notes", async (req, res) => {
    const text = boundedString(req.body?.text, 5000, { required: true });
    const author = req.body?.author === undefined ? "analyst" : boundedString(req.body.author, 120);
    if (!text || !author) return res.status(400).json({ status: "error", message: "A note and valid author are required" });
    try {
        const updated = await InvestigationCase.findOneAndUpdate(
            { caseId: req.params.caseId }, { $push: { notes: { $each: [{ text, author }], $slice: -500 } } },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ status: "error", message: "Case not found" });
        res.status(201).json({ status: "success", data: updated.notes[updated.notes.length - 1] });
    } catch { res.status(500).json({ status: "error", message: "Unable to add case note" }); }
});

router.post("/cases/:caseId/evidence", async (req, res) => {
    const type = req.body?.type;
    const reference = boundedString(req.body?.reference, 500, { required: true });
    const label = req.body?.label === undefined ? "" : boundedString(req.body.label, 200);
    const addedBy = req.body?.addedBy === undefined ? "analyst" : boundedString(req.body.addedBy, 120);
    const content = req.body?.content;
    if (!["session", "indicator", "timeline_event", "note", "report"].includes(type) || !reference || label === null || !addedBy ||
        (content !== undefined && (typeof content !== "string" || content.length > 100000))) {
        return res.status(400).json({ status: "error", message: "Invalid evidence fields" });
    }
    const contentHash = typeof content === "string" ? crypto.createHash("sha256").update(content).digest("hex") : undefined;
    try {
        const updated = await InvestigationCase.findOneAndUpdate(
            { caseId: req.params.caseId },
            { $push: { evidence: { $each: [{ type, reference, label, addedBy, contentHash }], $slice: -1000 } } },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ status: "error", message: "Case not found" });
        res.status(201).json({ status: "success", data: updated.evidence[updated.evidence.length - 1] });
    } catch { res.status(500).json({ status: "error", message: "Unable to attach evidence" }); }
});

router.get("/sessions/:sessionId/timeline", async (req, res) => {
    const sessionId = boundedString(req.params.sessionId, 200, { required: true });
    if (!sessionId || /[\\/\0-\x1f\x7f]/.test(sessionId)) return res.status(400).json({ status: "error", message: "Invalid session ID" });
    const limit = boundedLimit(req.query.limit, 500, 2000);
    if (limit === null) return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
    try {
        const [turns, audit] = await Promise.all([
            ConversationTurn.find({ sessionId }).sort({ timestamp: 1 }).limit(limit).select("turnIndex role text timestamp detectedScamIntent extractedIntel").lean(),
            AuditLog.find({ sessionId }).sort({ timestamp: 1 }).limit(limit).select("eventType timestamp detection intelligence notes safety").lean()
        ]);
        const timeline = [
            ...turns.map((item) => ({ source: "conversation", type: item.role === "user" ? "message_received" : "agent_response", timestamp: item.timestamp, turnIndex: item.turnIndex, role: item.role, text: item.text, detectedScamIntent: item.detectedScamIntent, indicators: item.extractedIntel || {} })),
            ...audit.map((item) => ({ source: "audit", type: item.eventType, timestamp: item.timestamp, detection: item.detection || null, indicators: item.intelligence || null, notes: item.notes || "", safety: item.safety || [] }))
        ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        res.json({ status: "success", count: timeline.length, data: timeline, truncated: turns.length === limit || audit.length === limit });
    } catch { res.status(500).json({ status: "error", message: "Unable to build session timeline" }); }
});

router.post("/feedback", async (req, res) => {
    const sessionId = boundedString(req.body?.sessionId, 200, { required: true });
    const label = req.body?.label;
    const analyst = req.body?.analyst === undefined ? "analyst" : boundedString(req.body.analyst, 120);
    const note = req.body?.note === undefined ? "" : boundedString(req.body.note, 3000);
    const modelVersion = req.body?.modelVersion === undefined ? "" : boundedString(req.body.modelVersion, 100);
    const confidence = req.body?.confidenceAtReview;
    if (!sessionId || /[\\/\0-\x1f\x7f]/.test(sessionId) || !FEEDBACK_LABELS.includes(label) || !analyst || note === null || modelVersion === null ||
        (confidence !== undefined && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1))) {
        return res.status(400).json({ status: "error", message: "Invalid analyst feedback fields" });
    }
    try {
        const item = await AnalystFeedback.create({ sessionId, label, analyst, note, modelVersion, confidenceAtReview: confidence });
        res.status(201).json({ status: "success", data: item });
    } catch { res.status(500).json({ status: "error", message: "Unable to save feedback" }); }
});

router.get("/feedback/summary", async (_req, res) => {
    try {
        const [counts, recent] = await Promise.all([
            AnalystFeedback.aggregate([{ $group: { _id: "$label", count: { $sum: 1 } } }]),
            AnalystFeedback.find().sort({ reviewedAt: -1 }).limit(100).select("sessionId label analyst note modelVersion confidenceAtReview reviewedAt").lean()
        ]);
        res.json({ status: "success", data: { counts: Object.fromEntries(counts.map((row) => [row._id, row.count])), total: counts.reduce((sum, row) => sum + row.count, 0), recent } });
    } catch { res.status(500).json({ status: "error", message: "Unable to summarize feedback" }); }
});

router.post("/url-analysis", (req, res) => {
    const result = analyzeUrl(req.body?.url);
    if (!result.valid) return res.status(400).json({ status: "error", message: result.error });
    res.json({ status: "success", data: result.data });
});

router.post("/indicators/observe", async (req, res) => {
    const kind = req.body?.kind;
    const value = boundedString(req.body?.value, 2048, { required: true });
    const source = req.body?.source === undefined ? "analyst_observation" : boundedString(req.body.source, 100, { required: true });
    const sessionId = req.body?.sessionId === undefined ? null : boundedString(req.body.sessionId, 200, { required: true });
    const status = req.body?.status === undefined ? "suspicious" : req.body.status;
    const confidence = req.body?.confidence === undefined ? 0.5 : req.body.confidence;
    if (!["url", "domain", "phone", "upi", "ip", "email", "other"].includes(kind) || !value || !source || (req.body?.sessionId !== undefined && !sessionId) ||
        !["unknown", "suspicious", "confirmed", "benign", "expired"].includes(status) ||
        typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return res.status(400).json({ status: "error", message: "Invalid indicator observation" });
    }
    const normalizedValue = normalizeIndicator(kind, value);
    if (!normalizedValue) return res.status(400).json({ status: "error", message: "Indicator could not be normalized safely" });
    try {
        const existing = await IndicatorReputation.findOne({ kind, normalizedValue });
        let item;
        if (existing) {
            existing.observationCount = Math.min(1000000, (existing.observationCount || 0) + 1);
            existing.lastSeenAt = new Date();
            existing.sources = [...new Set([...(existing.sources || []), source])].slice(-50);
            if (sessionId) existing.sessionIds = [...new Set([...(existing.sessionIds || []), sessionId])].slice(-500);
            existing.confidence = Math.max(existing.confidence || 0, confidence);
            if (status === "confirmed" || (status === "benign" && existing.status !== "confirmed")) existing.status = status;
            else if (existing.status === "unknown" && status !== "unknown") existing.status = status;
            existing.expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : existing.expiresAt;
            await existing.save();
            item = existing;
        } else {
            const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
            if (expiresAt && !Number.isFinite(expiresAt.getTime())) return res.status(400).json({ status: "error", message: "Invalid expiresAt date" });
            item = await IndicatorReputation.create({ kind, value, normalizedValue, status, confidence, sources: [source], sessionIds: sessionId ? [sessionId] : [], expiresAt });
        }
        res.status(201).json({ status: "success", data: item });
    } catch (error) {
        if (error?.code === 11000) return res.status(409).json({ status: "error", message: "Indicator was updated concurrently; retry the observation" });
        res.status(500).json({ status: "error", message: "Unable to record indicator" });
    }
});

router.get("/indicators", async (req, res) => {
    const limit = boundedLimit(req.query.limit);
    if (limit === null) return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
    const filter = {};
    if (req.query.kind !== undefined) {
        if (!["url", "domain", "phone", "upi", "ip", "email", "other"].includes(req.query.kind)) return res.status(400).json({ status: "error", message: "Unsupported indicator kind" });
        filter.kind = req.query.kind;
    }
    if (req.query.status !== undefined) {
        if (!["unknown", "suspicious", "confirmed", "benign", "expired"].includes(req.query.status)) return res.status(400).json({ status: "error", message: "Unsupported indicator status" });
        filter.status = req.query.status;
    }
    try {
        const rows = await IndicatorReputation.find(filter).sort({ lastSeenAt: -1 }).limit(limit).lean();
        const now = Date.now();
        res.json({ status: "success", count: rows.length, data: rows.map((row) => ({
            ...row,
            effectiveStatus: row.expiresAt && new Date(row.expiresAt).getTime() <= now ? "expired" : row.status
        })) });
    } catch { res.status(500).json({ status: "error", message: "Unable to list indicators" }); }
});

module.exports = { router, analyzeUrl, normalizeIndicator };
