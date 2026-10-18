// src/routes/ml.js
// Gateway to the CyberRakshak ML engine: /api/v1/ml/<module> → ml engine /api/<module>.
// A plain fetch-forwarder (not a streaming proxy) because express.json() has already
// consumed the request body by the time it reaches here — a stream proxy would hang on POST.

const express = require("express");
const router = express.Router();
const { ML_URL } = require("../services/mlProcessManager");

const ALLOWED = new Set([
    "scam", "behavior", "fakenews", "phishing", "loan",
    "loan/rules", "loan/check-app", "threat", "health", "version",
]);
const TIMEOUT_MS = 20000;

router.all("/*path", async (req, res) => {
    const sub = [].concat(req.params.path).join("/");
    if (!ALLOWED.has(sub)) {
        return res.status(404).json({ error: "Unknown ML endpoint", endpoint: sub });
    }
    if (req.method !== "GET" && req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        const upstream = await fetch(`${ML_URL}/api/${sub}${qs}`, {
            method: req.method,
            headers: { "Content-Type": "application/json" },
            body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
            signal: controller.signal,
        });
        const text = await upstream.text();
        res.status(upstream.status).type(upstream.headers.get("content-type") || "application/json").send(text);
    } catch (err) {
        res.status(503).json({
            error: "CyberRakshak ML engine unreachable",
            detail: err.name === "AbortError" ? "timed out" : err.message,
        });
    } finally {
        clearTimeout(timer);
    }
});

module.exports = router;
