"use strict";

const assert = require("node:assert/strict");
const { prioritizeAlert, prioritizeAlerts, normalizeSeverity } = require("../src/services/alertTriageService");

const critical = prioritizeAlert({
    type: "critical_risk",
    severity: "CRITICAL",
    riskScore: 98,
    novelty: "new",
    repeatCount: 8,
    evidenceCount: 6,
    timestamp: new Date().toISOString()
});
assert.equal(critical.priority, "P1");
assert.equal(critical.severity, "CRITICAL");
assert.ok(critical.score <= 100);
assert.ok(critical.factors.some((factor) => factor.name === "risk_score"));
assert.match(critical.disclaimer, /not proof/i);

const low = prioritizeAlert({ severity: "LOW", riskScore: 10, timestamp: new Date(Date.now() - 10 * 86400000).toISOString() });
assert.ok(critical.score > low.score);
assert.equal(normalizeSeverity("weird"), "INFO");
assert.equal(prioritizeAlert({ severity: "HIGH", riskScore: 110 }).factors.find((f) => f.name === "risk_score").detail, "Recorded risk score is 100/100");

const sorted = prioritizeAlerts([
    { id: "low", severity: "LOW" },
    { id: "high", severity: "HIGH", riskScore: 85 },
    { id: "critical", severity: "CRITICAL", riskScore: 99 }
]);
assert.equal(sorted[0].id, "critical");
assert.equal(sorted[2].id, "low");
assert.throws(() => prioritizeAlerts({}), /alerts must be an array/);
console.log("alert-triage: all assertions passed");
