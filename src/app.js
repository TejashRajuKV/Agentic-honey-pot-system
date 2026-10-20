// src/app.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
const HAS_FRONTEND = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));

const app = express();
app.disable("x-powered-by");   // don't advertise the framework

// Middleware — allow both the GUVI evaluator and the CyberRakshak React frontend
// Same-origin production requests do not need CORS. For Vite development or a
// separately hosted console, explicitly list trusted origins in ALLOWED_ORIGINS.
// Never reflect arbitrary origins: CORS is not authentication, but wildcard access
// makes it easier for an untrusted website to interact with a user's browser.
const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        // Requests without Origin are server-to-server / CLI clients and are not
        // protected by CORS; sensitive routes still require their own auth.
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        const error = new Error("Origin not allowed by CORS");
        error.status = 403;
        return cb(error);
    },
    credentials: false,
}));

// Parse JSON with any content-type (GUVI tester may not send Content-Type header)
app.use(express.json({ type: '*/*', limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Fallback: ensure req.body is always an object even if parsing fails
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        req.body = {};
    }
    next();
});

// ✅ Health check routes — NO AUTH REQUIRED
// These must be registered BEFORE the authenticated API routes
app.get("/", (req, res, next) => {
    // Browsers get the web console (when built); evaluators / curl keep the JSON health probe
    if (HAS_FRONTEND && req.accepts(["json", "html"]) === "html") return next();
    res.json({
        status: "ok",
        message: "Agentic Honey-Pot Backend is running 🐝",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
});

// Dedicated health endpoint for evaluation platform probes
app.get("/api/v1/health", (req, res) => {
    res.json({
        status: "ok",
        service: "agentic-honeypot",
        version: "2.1.0",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        timestamp: new Date().toISOString()
    });
});

// Alias — some evaluators probe /ping or /api/v1/ping
app.get("/ping", (req, res) => res.json({ status: "ok" }));
app.get("/api/v1/ping", (req, res) => res.json({ status: "ok" }));

// Serve static files from public directory (dashboard)
app.use(express.static('public'));

// Apply conservative per-client limits to expensive console/ML and alert APIs.
// The evaluator-facing /api/v1/messages endpoint retains its separate x-api-key contract.
const { createRateLimiter } = require("./middleware/rateLimit");
const { consoleAuth } = require("./middleware/consoleAuth");
const consoleRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });
// Keep integration tests from tripping the production per-minute ceiling while
// exercising many ML endpoints in one run. Production defaults remain conservative.
const mlRateLimit = createRateLimiter({
    windowMs: 60_000,
    maxRequests: process.env.NODE_ENV === "test" ? 500 : 30,
});
const alertsRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 60 });

// API Routes
// Login/session endpoints are intentionally mounted before the protected dashboard APIs.
app.use("/api/v1/auth", require("./routes/auth"));

const messageRoutes = require("./routes/messageRoutes");
const analyticsRoutes = require("./routes/analytics");
const intelligenceRoutes = require("./routes/intelligence");
const profilerRoutes = require("./routes/profiler");
const alertsRoutes = require("./routes/alerts");
const qualityRoutes = require("./routes/quality");
const reportsRoutes = require("./routes/reports");
const languageRoutes = require("./routes/language");

app.use("/api/v1", messageRoutes);
app.use("/api/v1/analytics", consoleAuth, analyticsRoutes);
app.use("/api/v1/intelligence", consoleAuth, intelligenceRoutes);
app.use("/api/v1/profiles", consoleAuth, profilerRoutes);
app.use("/api/v1/alerts", alertsRateLimit, consoleAuth, alertsRoutes);
app.use("/api/v1/quality", consoleAuth, qualityRoutes);
app.use("/api/v1/reports", consoleAuth, reportsRoutes);
app.use("/api/v1/language", consoleAuth, languageRoutes);

// ── System status + first-party web-console API ───────────────────────────
app.use("/api/v1/system", consoleAuth, require("./routes/system"));
app.use("/api/v1/console", consoleRateLimit, consoleAuth, require("./routes/console"));

// ── CyberRakshak ML engine gateway: /api/v1/ml/<module> → ml/ Flask /api/<module> ──
app.use("/api/v1/ml", mlRateLimit, consoleAuth, require("./routes/ml"));

// Unknown API paths get JSON 404s (never the SPA shell)
app.use("/api", (req, res) => {
    // Do not reflect the raw URL: query strings can contain credentials or other secrets.
    res.status(404).json({ status: "error", message: "No such API route" });
});

// ── Web console (React build) — one server, one origin, one port ──────────
if (HAS_FRONTEND) {
    app.use(express.static(FRONTEND_DIST));
    // SPA fallback so client-side routes (/dashboard …) survive a hard refresh
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
    console.log(`🖥️  Serving web console from ${FRONTEND_DIST}`);
} else {
    console.log("ℹ️  frontend/dist not found — run `npm run build` (or `npm run dev` for the Vite dev server)");
}

// ── Error handling: the API always answers in JSON and never leaks internals ─────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ status: "error", message: "Request body is not valid JSON" });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ status: "error", message: "Request body is too large" });
    }
    if (status >= 500) console.error("Unhandled request error:", err.message);
    return res.status(status).json({ status: "error", message: status >= 500 ? "Internal server error" : err.message });
});

module.exports = app;
