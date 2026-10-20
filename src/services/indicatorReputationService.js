const { domainToASCII } = require("url");
const IndicatorReputation = require("../models/IndicatorReputation");

function normalize(kind, raw) {
    const value = String(raw || "").trim();
    if (!value || value.length > 2048) return null;
    if (kind === "url") {
        try {
            const url = new URL(value);
            if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
            url.hash = "";
            return url.toString().toLowerCase();
        } catch { return null; }
    }
    if (kind === "domain") return domainToASCII(value.toLowerCase().replace(/\.$/, "")) || null;
    if (kind === "phone") return value.replace(/\D/g, "").slice(-15) || null;
    return value.toLowerCase();
}

/** Records indicators only after the primary detector has marked a session as suspicious. */
async function recordObservedIndicators(intelligence, sessionId, detection = {}) {
    if (!intelligence || typeof intelligence !== "object" || typeof sessionId !== "string" || !sessionId.trim()) return { recorded: 0 };
    const candidates = [];
    for (const value of (Array.isArray(intelligence.urls) ? intelligence.urls : []).slice(0, 50)) {
        const normalized = normalize("url", value);
        if (!normalized) continue;
        candidates.push({ kind: "url", value, normalizedValue: normalized });
        try {
            const hostname = new URL(normalized).hostname;
            const domain = normalize("domain", hostname);
            if (domain) candidates.push({ kind: "domain", value: hostname, normalizedValue: domain });
        } catch { /* normalized URL already validated */ }
    }
    for (const value of (Array.isArray(intelligence.upiIds) ? intelligence.upiIds : []).slice(0, 50)) {
        const normalized = normalize("upi", value);
        if (normalized) candidates.push({ kind: "upi", value, normalizedValue: normalized });
    }
    for (const value of (Array.isArray(intelligence.phoneNumbers) ? intelligence.phoneNumbers : []).slice(0, 50)) {
        const normalized = normalize("phone", value);
        if (normalized) candidates.push({ kind: "phone", value, normalizedValue: normalized });
    }
    const confidenceValue = Number(detection.confidence);
    const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0;
    const unique = [...new Map(candidates.map((item) => [`${item.kind}:${item.normalizedValue}`, item])).values()].slice(0, 150);
    if (!unique.length) return { recorded: 0 };
    try {
        const operations = unique.map((item) => ({
            updateOne: {
                filter: { kind: item.kind, normalizedValue: item.normalizedValue },
                update: {
                    $setOnInsert: { kind: item.kind, value: item.value, normalizedValue: item.normalizedValue, status: "suspicious", firstSeenAt: new Date() },
                    $set: { lastSeenAt: new Date() },
                    $max: { confidence },
                    $inc: { observationCount: 1 },
                    $addToSet: { sources: "honeypot_session" }
                },
                upsert: true
            }
        }));
        await IndicatorReputation.bulkWrite(operations, { ordered: false });
        return { recorded: unique.length };
    } catch {
        // Reputation is enrichment, not a dependency of the honeypot response path.
        return { recorded: 0, degraded: true };
    }
}

module.exports = { normalize, recordObservedIndicators };
