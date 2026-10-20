const scenarios = [
    { id: "credential-urgency", name: "Credential urgency", expected: "phishing", messages: ["Your account will be suspended today. Verify your login immediately.", "Use the secure link to confirm your password."] },
    { id: "payment-impersonation", name: "Payment impersonation", expected: "payment_scam", messages: ["I am from support. Send the verification payment to sample123@bank.", "Pay immediately or your service will be disconnected."] },
    { id: "suspicious-link", name: "Suspicious link", expected: "phishing", messages: ["Open https://example.invalid/verify to claim your reward.", "Enter your OTP to complete the claim."] },
    { id: "benign-support", name: "Benign support question", expected: "benign", messages: ["Hello, could you explain the refund policy?", "I would like to know the expected delivery date."] }
];

function getScenarios() {
    return scenarios.map(({ id, name, expected, messages }) => ({ id, name, expected, messageCount: messages.length }));
}

function runSimulation(selectedIds, rules) {
    if (selectedIds?.some((id) => !scenarios.some((scenario) => scenario.id === id))) throw new TypeError("Unknown scenario ID");
    const selected = selectedIds?.length ? scenarios.filter((scenario) => selectedIds.includes(scenario.id)) : scenarios;
    if (!selected.length) throw new TypeError("No known simulation scenarios selected");
    const sampleRows = selected.flatMap((scenario) => scenario.messages.map((message) => ({ scenarioId: scenario.id, expected: scenario.expected, message })));
    const replay = require("./ruleLabService").replayRules(rules, sampleRows.map((row) => row.message));
    const matched = new Set(replay.results.flatMap((rule) => rule.samples.map((sample) => sample.sampleIndex)));
    const byScenario = selected.map((scenario) => {
        const indexes = sampleRows.map((row, index) => row.scenarioId === scenario.id ? index : -1).filter((index) => index >= 0);
        const hitIndexes = indexes.filter((index) => matched.has(index));
        return {
            id: scenario.id, name: scenario.name, expected: scenario.expected,
            sampleCount: indexes.length, matchedCount: hitIndexes.length,
            coverage: indexes.length ? Number((hitIndexes.length / indexes.length).toFixed(3)) : 0,
            outcome: hitIndexes.length ? "rule_match" : "no_rule_match",
            matches: replay.results.filter((rule) => rule.samples.some((sample) => hitIndexes.includes(sample.sampleIndex))).map((rule) => rule.name)
        };
    });
    return {
        scenarios: byScenario,
        summary: {
            scenarios: selected.length,
            messages: sampleRows.length,
            messagesMatched: matched.size,
            messageMatchRate: sampleRows.length ? Number((matched.size / sampleRows.length).toFixed(3)) : 0,
            benignMessagesMatched: sampleRows.filter((row, index) => row.expected === "benign" && matched.has(index)).length,
            rulesUsed: rules.length
        },
        disclaimer: "Synthetic offline replay only. This does not contact external systems, run the honeypot agent, or establish real-world detection accuracy."
    };
}

module.exports = { getScenarios, runSimulation };
