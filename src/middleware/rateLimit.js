// src/middleware/rateLimit.js
// Small in-memory per-client rate limiter for expensive/public API surfaces.
// For multi-instance deployments, use a shared store at the edge or in Redis.
function createRateLimiter(options = {}) {
    const windowMs = Number(options.windowMs ?? 60_000);
    const maxRequests = Number(options.maxRequests ?? 60);
    const maxKeys = Number(options.maxKeys ?? 10_000);
    const now = options.now || Date.now;
    const keyGenerator = options.keyGenerator || ((req) => req.ip || req.socket?.remoteAddress || "unknown");
    const buckets = new Map();
    let requestsSinceSweep = 0;

    if (!Number.isFinite(windowMs) || windowMs < 1 || !Number.isInteger(maxRequests) || maxRequests < 1) {
        throw new TypeError("Rate limiter requires a positive windowMs and positive integer maxRequests");
    }

    function sweepExpired(currentTime) {
        for (const [key, bucket] of buckets) {
            if (bucket.resetAt <= currentTime) buckets.delete(key);
        }
    }

    return function rateLimit(req, res, next) {
        const currentTime = now();
        const rawKey = keyGenerator(req);
        const key = typeof rawKey === "string" && rawKey ? rawKey : "unknown";
        let bucket = buckets.get(key);

        if (!bucket || bucket.resetAt <= currentTime) {
            if (!bucket && buckets.size >= maxKeys) {
                sweepExpired(currentTime);
                if (buckets.size >= maxKeys) {
                    // Bound memory if an attacker rotates source identifiers.
                    const oldestKey = buckets.keys().next().value;
                    if (oldestKey !== undefined) buckets.delete(oldestKey);
                }
            }
            bucket = { count: 0, resetAt: currentTime + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;
        requestsSinceSweep += 1;
        if (requestsSinceSweep >= 256) {
            sweepExpired(currentTime);
            requestsSinceSweep = 0;
        }

        const remaining = Math.max(0, maxRequests - bucket.count);
        const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
        res.setHeader("RateLimit-Limit", String(maxRequests));
        res.setHeader("RateLimit-Remaining", String(remaining));
        res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > maxRequests) {
            res.setHeader("Retry-After", String(resetSeconds));
            return res.status(429).json({
                status: "error",
                code: "RATE_LIMITED",
                message: "Too many requests. Please try again later.",
            });
        }

        return next();
    };
}

module.exports = { createRateLimiter };
