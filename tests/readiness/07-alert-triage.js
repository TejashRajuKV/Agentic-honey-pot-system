"use strict";
const { prioritizeAlert, prioritizeAlerts, normalizeSeverity } = require("../../src/services/alertTriageService");

exports.title = "Explainable alert triage";
exports.run = async function (t) {
  await t.check("scores severity and risk with explanation", () => {
    const result = prioritizeAlert({ severity: "CRITICAL", riskScore: 95, timestamp: new Date().toISOString() });
    if (!(result.score > 0 && result.score <= 100)) throw new Error("Score must be bounded to 0–100");
    if (result.severity !== "CRITICAL") throw new Error("Severity was not normalized");
    if (!result.factors.some((factor) => factor.name === "risk_score")) throw new Error("Risk contribution missing");
  });
  await t.check("unknown severity defaults safely", () => {
    if (normalizeSeverity("mystery") !== "INFO") throw new Error("Unknown severity should become INFO");
  });
  await t.check("prioritizes higher-severity alert first", () => {
    const rows = prioritizeAlerts([{ id: "low", severity: "LOW" }, { id: "high", severity: "HIGH", riskScore: 85 }]);
    if (rows[0].id !== "high") throw new Error("Higher priority alert was not ranked first");
  });
  await t.check("disclaims attribution", () => {
    if (!/not proof/i.test(prioritizeAlert({}).disclaimer)) throw new Error("Triage caveat missing");
  });
};
