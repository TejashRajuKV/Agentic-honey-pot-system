const TYPES = new Set(["contains", "phrase_any", "url_present", "upi_present", "phone_present", "starts_with"]);
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/i;
const UPI_PATTERN = /\b[a-z0-9._-]{2,}@[a-z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){9,15}/;

function validateRule(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return "rule must be an object";
    if (typeof rule.name !== "string" || !rule.name.trim() || rule.name.length > 120) return "name must be a non-empty string of at most 120 characters";
    if (!TYPES.has(rule.type)) return "unsupported rule type";
    if (rule.terms !== undefined && (!Array.isArray(rule.terms) || rule.terms.length > 30 || rule.terms.some((term) => typeof term !== "string" || !term.trim() || term.length > 160))) return "terms must contain at most 30 non-empty strings of at most 160 characters";
    if (["contains", "phrase_any", "starts_with"].includes(rule.type) && !(rule.terms || []).length) return "this rule type requires at least one term";
    if (rule.severity !== undefined && !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(rule.severity)) return "unsupported severity";
    return null;
}

function matchesRule(rule, message) {
    const text = String(message || "");
    const lower = text.toLowerCase();
    switch (rule.type) {
        case "contains": return (rule.terms || []).some((term) => lower.includes(term.toLowerCase()));
        case "phrase_any": return (rule.terms || []).some((term) => lower.includes(term.toLowerCase()));
        case "starts_with": return (rule.terms || []).some((term) => lower.trimStart().startsWith(term.toLowerCase()));
        case "url_present": return URL_PATTERN.test(text);
        case "upi_present": return UPI_PATTERN.test(text);
        case "phone_present": return PHONE_PATTERN.test(text);
        default: return false;
    }
}

/** Replay is bounded and deterministic; arbitrary user-supplied regular expressions are never evaluated. */
function replayRules(rules, samples) {
    if (!Array.isArray(rules) || rules.length > 100) throw new TypeError("rules must be an array with at most 100 rules");
    if (!Array.isArray(samples) || samples.length > 500 || samples.some((sample) => typeof sample !== "string" || sample.length > 10000)) {
        throw new TypeError("samples must contain at most 500 strings of at most 10000 characters");
    }
    const results = rules.map((rule) => {
        const matches = [];
        samples.forEach((sample, index) => {
            if (matchesRule(rule, sample)) matches.push({ sampleIndex: index, preview: sample.slice(0, 240) });
        });
        return {
            ruleId: rule.ruleId || null,
            name: rule.name,
            type: rule.type,
            severity: rule.severity || "MEDIUM",
            matches: matches.length,
            matchRate: samples.length ? Number((matches.length / samples.length).toFixed(4)) : 0,
            samples: matches.slice(0, 100)
        };
    });
    return { sampleCount: samples.length, ruleCount: rules.length, matchedSamples: new Set(results.flatMap((r) => r.samples.map((m) => m.sampleIndex))).size, results };
}

module.exports = { TYPES, validateRule, matchesRule, replayRules };
