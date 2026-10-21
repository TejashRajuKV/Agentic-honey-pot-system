"use strict";
const assert = require("node:assert/strict");
const { prioritizeAlert, prioritizeAlerts, normalizeSeverity } = require("../../src/services/alertTriageService");

module.exports = async function alertTriageReadiness() {
  const recent = { severity: "HIGH", riskScore: 80, novelty: "rare", repeatCount: 3, evidenceCount: 2, timestamp: new Date().toISOString() };
  const result = prioritizeAlert(recent);
  assert.equal(result.priority, prioritizeAlert(recent).priority);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.ok(result.factors.length > 0);
  assert.equal(normalizeSeverity("unknown"), "INFO");
  assert.equal(prioritizeAlerts([recent])[0].triage.priority, result.priority);
  return { name: "explainable-alert-triage", status: "passed", priority: result.priority };
};
