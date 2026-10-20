const assert = require("node:assert/strict");
const { getScenarios, runSimulation } = require("../src/services/simulationService");

const scenarios = getScenarios();
assert.equal(scenarios.length, 4);
assert.ok(scenarios.some((scenario) => scenario.expected === "benign"));
const rules = [
    { ruleId: "R1", name: "Urgency", type: "phrase_any", terms: ["immediately", "suspended"], severity: "HIGH" },
    { ruleId: "R2", name: "URL", type: "url_present", terms: [], severity: "HIGH" }
];
const result = runSimulation(["credential-urgency", "suspicious-link", "benign-support"], rules);
assert.equal(result.summary.scenarios, 3);
assert.equal(result.summary.messages, 6);
assert.ok(result.scenarios.find((scenario) => scenario.id === "credential-urgency").matchedCount > 0);
assert.ok(result.scenarios.find((scenario) => scenario.id === "suspicious-link").matchedCount > 0);
assert.equal(result.summary.benignMessagesMatched, 0);
assert.equal(result.summary.rulesUsed, 2);
assert.throws(() => runSimulation(["unknown"], rules), /Unknown scenario/);
assert.match(result.disclaimer, /Synthetic offline replay/);
console.log("Offline simulation checks passed (9 assertions).");
