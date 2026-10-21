"use strict";
const { T } = require("./harness");
const { prioritizeAlert, prioritizeAlerts, normalizeSeverity } = require("../../src/services/alertTriageService");
exports.title = "Explainable alert triage";
exports.run = async function (t) {
  t.test("scores severity and risk", () => {
    const result = prioritizeAlert({ severity: "CRITICAL", riskScore: 95, timestamp: new Date().toISOString() });
    t.assert(result.score > 0 && result.score <= 100);
    t.assertEqual(result.severity, "CRITICAL");
    t.assert(result.factors.some((factor) => factor.name === "risk_score"));
  });
  t.test("unknown severity defaults safely", () => t.assertEqual(normalizeSeverity("mystery"), "INFO"));
  t.test("sorts by score descending", () => {
    const rows = prioritizeAlerts([{ id: "low", severity: "LOW" }, { id: "high", severity: "HIGH", riskScore: 85 }]);
    t.assertEqual(rows[0].id, "high");
  });
  t.test("labels result as triage, not proof", () => t.assert(/not proof/i.test(prioritizeAlert({}).disclaimer));
};
