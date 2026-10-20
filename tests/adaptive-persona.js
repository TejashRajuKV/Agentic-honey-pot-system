const assert = require("node:assert/strict");
const { selectAdaptivePersona, buildSystemPrompt, buildAgentPrompt } = require("../agent/personaPrompts");

assert.equal(selectAdaptivePersona(["payment scam"], "early").id, "payment-customer");
assert.equal(selectAdaptivePersona(["credential phishing"], "mid").id, "account-holder");
assert.equal(selectAdaptivePersona(["government impersonation"], "late").id, "authority-check");
assert.equal(selectAdaptivePersona(["delivery parcel"], "final").id, "delivery-customer");
assert.equal(selectAdaptivePersona([], "unknown").id, "general-customer");
assert.equal(selectAdaptivePersona(["bank"], "mid", "concerned").emotionalTone, "concerned");
assert.match(buildSystemPrompt("early", ["payment"]).toLowerCase(), /adaptive persona: payment-customer/);
assert.match(buildAgentPrompt("Please explain", [], "early", ["payment"], "curious"), /Tone: curious/);
console.log("Adaptive persona checks passed (8 assertions).");
