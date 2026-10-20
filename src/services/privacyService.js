const DEFAULT_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

function configuredRetentionDays(raw = process.env.DATA_RETENTION_DAYS) {
    if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < MIN_RETENTION_DAYS || value > MAX_RETENTION_DAYS) return DEFAULT_RETENTION_DAYS;
    return value;
}

function redactText(raw) {
    if (typeof raw !== "string" || raw.length > 50000) throw new TypeError("text must be a string of at most 50000 characters");
    let text = raw;
    const counts = { email: 0, phone: 0, upi: 0, sensitiveUrlParameter: 0 };
    const replace = (regex, replacement, key) => {
        text = text.replace(regex, (...args) => { counts[key] += 1; return typeof replacement === "function" ? replacement(...args) : replacement; });
    };
    replace(/\b([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})\b/gi, (_match, local, domain) => `${local[0]}***@${domain}`, "email");
    replace(/\b(?:\+?\d[\s().-]*){9,15}\b/g, "[REDACTED_PHONE]", "phone");
    replace(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/gi, "[REDACTED_UPI]", "upi");
    text = text.replace(/([?&](?:token|access_token|refresh_token|api[_-]?key|password|passwd|otp|code|secret)=)[^&#\s]*/gi, (_match, prefix) => {
        counts.sensitiveUrlParameter += 1;
        return prefix + "[REDACTED]";
    });
    return { redactedText: text, counts, changed: Object.values(counts).some((count) => count > 0) };
}

module.exports = {
    redactText,
    configuredRetentionDays,
    MIN_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS
};
