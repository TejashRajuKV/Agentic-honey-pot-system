// src/routes/system.js
// One place that reports the health of every subsystem of the integrated platform.
// The frontend's navbar and the Home "Engine Diagnostics" panel read from this —
// nothing on those screens is hardcoded.

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const mlManager = require("../services/mlProcessManager");

router.get("/status", async (req, res) => {
    const started = Date.now();
    const ml = await mlManager.status();
    const mlLatencyMs = ml.reachable ? Date.now() - started : null;

    let db = { connected: mongoose.connection.readyState === 1, latencyMs: null, sessions: null, scamSessions: null };
    if (db.connected) {
        try {
            const t0 = Date.now();
            const Session = require("../models/Session");
            const [sessions, scamSessions] = await Promise.all([
                Session.estimatedDocumentCount(),
                Session.countDocuments({ scamEverDetected: true }),
            ]);
            db = { ...db, latencyMs: Date.now() - t0, sessions, scamSessions };
        } catch { /* leave partial */ }
    }

    let alerts = { webhookConfigured: false, channels: [] };
    try {
        const cfg = await require("../models/AlertConfig").findOne().lean();
        if (cfg) alerts = { webhookConfigured: Boolean(cfg.webhookUrl), channels: cfg.channels || [], enabled: cfg.enabled };
    } catch { /* db may be down */ }

    const llm = Boolean(process.env.LLM_API_KEY);
    const modules = ml.health?.modules || {};

    res.json({
        status: "success",
        data: {
            timestamp: new Date().toISOString(),
            api: { online: true, version: "2.1.0", uptimeSec: Math.round(process.uptime()) },
            ml: { ...ml, latencyMs: mlLatencyMs, modules },
            db,
            agent: { llmConfigured: llm, mode: llm ? "LLM + rule-based fallback" : "rule-based" },
            alerts,
            integrations: {
                evaluatorApiKeyConfigured: Boolean(process.env.API_KEY),
                finalCallbackConfigured: true,                       // always: defaults to the GUVI endpoint
                finalCallbackHost: require("../../agent/callbackService").getCallbackTarget().host,
                finalCallbackSource: require("../../agent/callbackService").getCallbackTarget().source,
                breachLookupConfigured: Boolean(process.env.HIBP_API_KEY),
            },
            operational: ml.reachable && db.connected,
        },
    });
});

module.exports = router;
