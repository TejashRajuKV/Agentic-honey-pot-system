// tests/console-auth.js
const assert = require("node:assert/strict");
const {
    SESSION_TTL_SECONDS,
    createSessionToken,
    verifySessionToken,
    parseCookies,
    safeEqual,
} = require("../src/middleware/consoleAuth");

const now = 1_800_000_000_000;
process.env.CONSOLE_SESSION_SECRET = "test-only-secret-that-is-long-enough-for-hmac";
const token = createSessionToken(now);
assert.equal(verifySessionToken(token, now), true, "fresh signed session should validate");
assert.equal(verifySessionToken(token, now + (SESSION_TTL_SECONDS * 1000)), false, "expired session should fail");
assert.equal(verifySessionToken(token + "tampered", now), false, "tampered signature should fail");
assert.equal(verifySessionToken("not-a-token", now), false, "malformed session should fail");
assert.equal(verifySessionToken(null, now), false, "missing session should fail");
assert.equal(safeEqual("correct horse", "correct horse"), true);
assert.equal(safeEqual("correct horse", "wrong password"), false);
assert.deepEqual(parseCookies("a=one; cyberrakshak_console=abc.def; theme=dark"), {
    a: "one",
    cyberrakshak_console: "abc.def",
    theme: "dark",
});
assert.deepEqual(parseCookies(""), {});
console.log("PASS console-auth tests");
