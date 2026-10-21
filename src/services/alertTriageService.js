"use strict";

/**
 * Deterministic, explainable alert prioritization.
 *
 * The score ranks investigation urgency; it is not an attribution or guilt score.
 * Inputs are bounded and each contribution is returned to make ranking auditable.
 */
const SEVERITY_WEIGHT = Object.freeze({ INFO: 0, LOW: 8, MEDIUM: 18, HIGH: 30, CRITICAL: 40 });
const NOVELTY_WEIGHT = Object.freeze({ new: 15, rare: 8, known: 0, unknown: 0 });

function finiteNumber(value, fallback = 0) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSeverity(value) {
    const severity = String(value || "").trim().toUpperCase();
    return Object.hasOwn(SEVERITY_WEIGHT, severity) ? severity : "INFO";
}

function prioritizeAlert(alert = {}, context = {}) {
    const factors = [];
    let score = 0;
    const add = (name, points, detail) => {
        const bounded = Math.max(0, Math.min(40, Math.round(points)));
        score += bounded;
        factors.push({ name, points: bounded, detail });
    };

    const severity = normalizeSeverity(alert.severity || alert.payload?.severity || alert.payload?.alert?.severity);
    add("severity", SEVERITY_WEIGHT[severity], `Severity is ${severity}`);

    const risk = Math.max(0, Math.min(100, finiteNumber(
        alert.riskScore ?? alert.payload?.riskScore ?? alert.payload?.alert?.riskScore, 0
    )));
    if (risk >= 90) add("risk_score", 25, `Recorded risk score is ${risk}/100`);
    else if (risk >= 75) add("risk_score", 18, `Recorded risk score is ${risk}/100`);
    else if (risk >= 50) add("risk_score", 10, `Recorded risk score is ${risk}/100`);
    else if (risk > 0) add("risk_score", 4, `Recorded risk score is ${risk}/100`);

    const novelty = String(alert.novelty || context.novelty || "unknown").toLowerCase();
    if (Object.hasOwn(NOVELTY_WEIGHT, novelty) && NOVELTY_WEIGHT[novelty]) {
        add("novelty", NOVELTY_WEIGHT[novelty], novelty === "new" ? "Indicator or activity was marked new" : "Indicator or activity was marked rare");
    }

    const repeatCount = Math.max(0, Math.min(1000000, finiteNumber(
        alert.repeatCount ?? context.repeatCount ?? alert.payload?.matchCount ?? alert.payload?.alert?.matchCount, 0
    )));
    if (repeatCount >= 5) add("repeated_activity", 15, `${repeatCount} related observations or sessions`);
    else if (repeatCount >= 2) add("repeated_activity", 8, `${repeatCount} related observations or sessions`);

    const evidenceCount = Math.max(0, Math.min(1000000, finiteNumber(
        alert.evidenceCount ?? context.evidenceCount ?? alert.payload?.evidenceCount, 0
    )));
    if (evidenceCount >= 5) add("corroboration", 12, `${evidenceCount} evidence references`);
    else if (evidenceCount >= 2) add("corroboration", 6, `${evidenceCount} evidence references`);

    const created = new Date(alert.timestamp || alert.createdAt || alert.payload?.timestamp || 0).getTime();
    const ageHours = Number.isFinite(created) && created > 0 ? Math.max(0, (Date.now() - created) / 3600000) : null;
    if (ageHours !== null && ageHours <= 1) add("recency", 10, "Alert is at most one hour old");
    else if (ageHours !== null && ageHours <= 24) add("recency", 5, "Alert is at most one day old");

    score = Math.max(0, Math.min(100, score));
    const priority = score >= 75 ? "P1" : score >= 50 ? "P2" : score >= 25 ? "P3" : "P4";
    return {
        score,
        priority,
        severity,
        factors,
        recommendedAction: priority === "P1" ? "analyst_review_now"
            : priority === "P2" ? "review_soon"
                : priority === "P3" ? "queue_for_review" : "monitor",
        disclaimer: "Prioritization is a triage aid, not proof of malicious activity or identity. Review underlying evidence before consequential action."
    };
}

function prioritizeAlerts(alerts = [], contextByAlert = {}) {
    if (!Array.isArray(alerts)) throw new TypeError("alerts must be an array");
    return alerts.map((alert, index) => {
        const key = String(alert?.id || alert?._id || alert?.sessionId || index);
        return { ...alert, triage: prioritizeAlert(alert, contextByAlert[key] || {}) };
    }).sort((a, b) =>
        b.triage.score - a.triage.score ||
        new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime()
    );
}

module.exports = { prioritizeAlert, prioritizeAlerts, normalizeSeverity };
