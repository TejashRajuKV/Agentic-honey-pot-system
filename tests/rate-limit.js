// tests/rate-limit.js
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../src/middleware/rateLimit");

function responseRecorder() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

function invoke(limiter, ip) {
    const res = responseRecorder();
    let nextCalled = false;
    limiter({ ip }, res, () => { nextCalled = true; });
    return { res, nextCalled };
}

let clock = 1_000;
const limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 2, now: () => clock });
const first = invoke(limiter, "192.0.2.1");
assert.equal(first.nextCalled, true);
assert.equal(first.res.headers["RateLimit-Remaining"], "1");
const second = invoke(limiter, "192.0.2.1");
assert.equal(second.nextCalled, true);
assert.equal(second.res.headers["RateLimit-Remaining"], "0");
const third = invoke(limiter, "192.0.2.1");
assert.equal(third.nextCalled, false);
assert.equal(third.res.statusCode, 429);
assert.equal(third.res.body.code, "RATE_LIMITED");
assert.ok(Number(third.res.headers["Retry-After"]) >= 1);

// A different client has an independent bucket.
assert.equal(invoke(limiter, "192.0.2.2").nextCalled, true);

// Requests resume after the window expires.
clock += 10_001;
const afterWindow = invoke(limiter, "192.0.2.1");
assert.equal(afterWindow.nextCalled, true);
assert.equal(afterWindow.res.statusCode, 200);

// Missing IPs use a stable fallback key rather than crashing.
const missingIp = responseRecorder();
let missingIpNext = false;
limiter({}, missingIp, () => { missingIpNext = true; });
assert.equal(missingIpNext, true);

assert.throws(() => createRateLimiter({ windowMs: 0, maxRequests: 2 }), /positive windowMs/);
assert.throws(() => createRateLimiter({ windowMs: 1000, maxRequests: 0 }), /positive windowMs/);
console.log("PASS API rate-limit tests");
