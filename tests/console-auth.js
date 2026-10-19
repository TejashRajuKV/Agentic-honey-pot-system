// tests/console-auth.js
const assert = require("node:assert/strict");
const {
    SESSION_TTL_SECONDS,
    createSessionToken,
    verifySessionToken,
    parseCookies,
    safeEqual,
    configured,
    consoleAuth,
    COOKIE_NAME,
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

function responseRecorder() {
    return {
        statusCode: 200, body: null, headers: {},
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        setHeader(name, value) { this.headers[name] = value; return this; },
    };
}

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
delete process.env.CONSOLE_PASSWORD;
delete process.env.CONSOLE_SESSION_SECRET;
assert.equal(configured(), false);
const unconfiguredResponse = responseRecorder();
let unconfiguredNext = false;
consoleAuth({ headers: {}, ip: "test" }, unconfiguredResponse, () => { unconfiguredNext = true; });
assert.equal(unconfiguredNext, false, "production must fail closed without credentials");
assert.equal(unconfiguredResponse.statusCode, 503);

process.env.CONSOLE_PASSWORD = "a-long-test-password";
process.env.CONSOLE_SESSION_SECRET = "test-only-secret-that-is-long-enough-for-hmac";
assert.equal(configured(), true);
const unauthorizedResponse = responseRecorder();
consoleAuth({ headers: { cookie: "" } }, unauthorizedResponse, () => {});
assert.equal(unauthorizedResponse.statusCode, 401, "missing cookie should be rejected");

const validToken = createSessionToken();
const authorizedResponse = responseRecorder();
let authorizedNext = false;
consoleAuth({ headers: { cookie: COOKIE_NAME + "=" + validToken } }, authorizedResponse, () => { authorizedNext = true; });
assert.equal(authorizedNext, true, "valid signed cookie should be accepted");

if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = previousNodeEnv;
console.log("PASS console-auth tests");
