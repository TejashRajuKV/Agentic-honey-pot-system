// src/routes/auth.js
const express = require("express");
const { createSessionToken, safeEqual, setSessionCookie, clearSessionCookie, configured, verifySessionToken, parseCookies, COOKIE_NAME } = require("../middleware/consoleAuth");
const { createRateLimiter } = require("../middleware/rateLimit");
const loginRateLimit = createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 10 });

const router = express.Router();

function unavailable(res) {
    return res.status(503).json({
        status: "error",
        code: "CONSOLE_AUTH_NOT_CONFIGURED",
        message: "Set CONSOLE_PASSWORD and CONSOLE_SESSION_SECRET to enable console authentication.",
    });
}

router.get("/session", (req, res) => {
    if (!configured()) {
        if (process.env.NODE_ENV === "production") return unavailable(res);
        return res.json({ status: "success", authenticated: true, authEnabled: false });
    }
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    const authenticated = verifySessionToken(token);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "success", authenticated, authEnabled: true });
});

router.post("/login", loginRateLimit, (req, res) => {
    if (!configured()) {
        if (process.env.NODE_ENV === "production") return unavailable(res);
        return res.json({ status: "success", authenticated: true, authEnabled: false });
    }
    const password = req.body?.password;
    if (typeof password !== "string" || !safeEqual(password, process.env.CONSOLE_PASSWORD)) {
        return res.status(401).json({
            status: "error",
            code: "INVALID_CREDENTIALS",
            message: "Invalid password.",
        });
    }
    const token = createSessionToken();
    setSessionCookie(req, res, token);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "success", authenticated: true, authEnabled: true });
});

router.post("/logout", (req, res) => {
    clearSessionCookie(req, res);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ status: "success", authenticated: false });
});

module.exports = router;
