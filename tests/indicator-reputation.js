const assert = require("node:assert/strict");
const { normalize, recordObservedIndicators } = require("../src/services/indicatorReputationService");

assert.equal(normalize("domain", "EXAMPLE.com."), "example.com");
assert.equal(normalize("url", "https://EXAMPLE.com/path#fragment"), "https://example.com/path");
assert.equal(normalize("url", "javascript:alert(1)"), null);
assert.equal(normalize("url", "https://user:pass@example.com"), null);
assert.equal(normalize("phone", "+1 (555) 123-4567"), "15551234567");
assert.equal(normalize("upi", "Example123@BANK"), "example123@bank");
async function main() {
    assert.deepEqual(await recordObservedIndicators({}, "session-1", { confidence: 0.9 }), { recorded: 0 });
    console.log("Indicator reputation service checks passed (7 assertions).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
