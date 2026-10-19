// src/middleware/consoleAuth.js
const crypto = require("node:crypto");

const COOKIE_NAME = "cyberrakshak_console";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function configured() {
    return Boolean(process.env.CONSOLE_PASSWORD && process.env.CONSOLE_SESSION_SECRET);
}

function sign(value, secret = process.env.CONSOLE_SESSION_SECRET || "") {
    return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
    const a = crypto.createHash("sha256").update(String(left)).digest();
    const b = crypto.createHash("sha256").update(String(right)).digest();
    return crypto.timingSafeEqual(a, b);
}

function createSessionToken(now = Date.now()) {
    const payload = Buffer.from(JSON.stringify({
        exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
        nonce: crypto.randomBytes(16).toString("base64url"),
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token, now = Date.now()) {
    if (typeof token !== "string" || token.length > 2048) return false;
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    if (!safeEqual(signature, sign(payload))) return false;
    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return Number.isInteger(decoded.exp) && decoded.exp > Math.floor(now / 1000)
            && typeof decoded.nonce === "string" && decoded.nonce.length >= 16;
    } catch {
        return false;
    }
}

function parseCookies(header = "") {
    const cookies = {};
    for (const part of String(header).split(";")) {
        const index = part.indexOf("=");
        if (index < 1) continue;
        const name = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (name) cookies[name] = value;
    }
    return cookies;
}

function cookieOptions(req) {
    const secure = process.env.NODE_ENV === "production" || req.secure;
    return `Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

function setSessionCookie(req, res, token) {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; ${cookieOptions(req)}`);
}

function clearSessionCookie(req, res) {
    const secure = process.env.NODE_ENV === "production" || req.secure;
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`);
}

function isAuthEnabled() {
    return configured();
}

function consoleAuth(req, res, next) {
    if (!configured()) {
        if (process.env.NODE_ENV === "production") {
            return res.status(503).json({
                status: "error",
                code: "CONSOLE_AUTH_NOT_CONFIGURED",
                message: "Console authentication is not configured. Set CONSOLE_PASSWORD and CONSOLE_SESSION_SECRET.",
            });
        }
        // Local development stays convenient, but production fails closed.
        return next();
    }

    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!verifySessionToken(token)) {
        return res.status(401).json({
            status: "error",
            code: "AUTH_REQUIRED",
            message: "Please sign in to access the security console.",
        });
    }
    return next();
}

module.exports = {
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    configured,
    safeEqual,
    createSessionToken,
    verifySessionToken,
    parseCookies,
    setSessionCookie,
    clearSessionCookie,
    isAuthEnabled,
    consoleAuth,
};
