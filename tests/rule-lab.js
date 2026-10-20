const assert = require("node:assert/strict");
const { validateRule, matchesRule, replayRules } = require("../src/services/ruleLabService");

const rules = [
    { ruleId: "R1", name: "Urgency wording", type: "phrase_any", terms: ["urgent", "immediately"], severity: "HIGH" },
    { ruleId: "R2", name: "URL included", type: "url_present", terms: [], severity: "MEDIUM" },
    { ruleId: "R3", name: "UPI included", type: "upi_present", terms: [], severity: "HIGH" },
    { ruleId: "R4", name: "Starts with", type: "starts_with", terms: ["dear customer"], severity: "LOW" }
];
assert.equal(validateRule(rules[0]), null);
assert.match(validateRule({ name: "x", type: "contains", terms: [] }), /requires at least one term/);
assert.match(validateRule({ name: "x", type: "regex", terms: [] }), /unsupported/);
assert.equal(matchesRule(rules[0], "Please do this URGENTLY"), true);
assert.equal(matchesRule(rules[1], "Visit https://example.com"), true);
assert.equal(matchesRule(rules[2], "Pay to abc123@bank"), true);
assert.equal(matchesRule(rules[3], "  Dear Customer, verify"), true);
const result = replayRules(rules, [
    "Please do this URGENTLY",
    "Visit https://example.com",
    "Pay to abc123@bank",
    "  Dear Customer, verify"
]);
assert.equal(result.sampleCount, 4);
assert.equal(result.ruleCount, 4);
assert.equal(result.results[0].matches, 1);
assert.equal(result.results[1].matches, 1);
assert.equal(result.results[2].matches, 1);
assert.equal(result.results[3].matches, 1);
assert.equal(result.matchedSamples, 4);
assert.throws(() => replayRules(rules, Array(501).fill("x")), /at most 500/);
assert.throws(() => replayRules(rules, ["x".repeat(10001)]), /10000 characters/);
console.log("Rule lab checks passed (15 assertions).");
