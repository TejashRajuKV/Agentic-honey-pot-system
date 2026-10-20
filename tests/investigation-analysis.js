const assert = require("node:assert/strict");
const { analyzeUrl, normalizeIndicator } = require("../src/routes/investigations");

function run() {
    const safe = analyzeUrl("https://example.com/path?a=1");
    assert.equal(safe.valid, true);
    assert.equal(safe.data.hostname, "example.com");
    assert.equal(safe.data.assessment, "no_obvious_static_signals");
    assert.equal(safe.data.queryParameterCount, 1);
    assert.match(safe.data.disclaimer, /not contacted/i);

    const risky = analyzeUrl("http://192.0.2.10:8080/verify?next=%2Faccount");
    assert.equal(risky.valid, true);
    assert.ok(risky.data.signals.includes("literal_ip_host"));
    assert.ok(risky.data.signals.includes("unencrypted_http"));
    assert.ok(risky.data.signals.includes("nonstandard_port"));
    assert.ok(risky.data.heuristicScore >= 40);
    assert.equal(risky.data.assessment, "high_review_priority");

    assert.equal(analyzeUrl("javascript:alert(1)").valid, false);
    assert.equal(analyzeUrl("https://user:pass@example.com").valid, false);
    assert.equal(analyzeUrl("not a url").valid, false);
    assert.equal(analyzeUrl("https://example.com/" + "x".repeat(2100)).valid, false);
    assert.equal(analyzeUrl(null).valid, false);

    assert.equal(normalizeIndicator("domain", "Example.COM."), "example.com");
    assert.equal(normalizeIndicator("url", "https://EXAMPLE.com/path#fragment"), "https://example.com/path");
    assert.equal(normalizeIndicator("url", "javascript:alert(1)"), null);
    console.log("Investigation analysis checks passed (12 assertions).");
}
run();
