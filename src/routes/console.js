// src/routes/console.js
// First-party API for the web console (the React app served by this same server).
//
// The evaluator-facing endpoint POST /api/v1/messages stays protected by x-api-key. A browser
// bundle can't hold a secret, so the console gets its own same-origin entry points that run the
// exact same pipeline (detection → ML enrichment → persona agent → intelligence extraction).

const express = require("express");
const router = express.Router();
const { createRateLimiter } = require("../middleware/rateLimit");
const breachLookupRateLimit = createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 10, maxKeys: 5000 });
const analysisRateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 30, maxKeys: 5000 });
const { handleIncomingMessage } = require("../controllers/messageController");
const { getConversationHistory, getSessionIntelligence } = require("../services/sessionService");
const Session = require("../models/Session");
const ConversationTurn = require("../models/ConversationTurn");
const ScammerIntelligence = require("../models/ScammerIntelligence");
const { detectScamIntent } = require("../../detection/scamDetector");
const { detectEmotion } = require("../../detection/emotionDetector");
const { extractIntelligence, extractAmounts } = require("../../detection/intelligenceExtractor");
const { getMLScamConfidence } = require("../services/mlBridgeService");
const riskFusion = require("../services/riskFusionService");
const killChain = require("../services/killChainService");
const campaigns = require("../services/campaignService");
const stix = require("../services/stixService");
const incidents = require("../services/incidentService");
const { getSessionAudit, getAuditStats } = require("../services/auditService");

/** POST /api/v1/console/messages — engage the honeypot agent from the UI */
router.post("/messages", (req, res, next) => {
    const text = req.body?.message;
    if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ status: "error", message: "message (non-empty string) is required" });
    }
    req.body = { ...req.body, message: text.slice(0, 4000), metadata: { channel: "Web Console", ...(req.body.metadata || {}) } };
    return handleIncomingMessage(req, res, next);
});

/**
 * POST /api/v1/console/breach-check — is this email in a known data breach? (Have I Been Pwned)
 * The HIBP key lives on the server (HIBP_API_KEY); without it we say so instead of inventing results.
 */
router.post("/breach-check", breachLookupRateLimit, async (req, res) => {
    const rawEmail = req.body?.email;
    if (typeof rawEmail !== "string" || rawEmail.length > 320) {
        return res.status(400).json({ status: "error", message: "A valid email address is required" });
    }
    const email = rawEmail.trim();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ status: "error", message: "A valid email address is required" });
    }
    const key = process.env.HIBP_API_KEY;
    if (!key) {
        return res.status(503).json({
            status: "error",
            configured: false,
            message: "Breach lookup is not configured on this server (set HIBP_API_KEY in .env).",
        });
    }
    try {
        const upstream = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            { headers: { "hibp-api-key": key, "user-agent": "CyberRakshak-Platform" }, signal: AbortSignal.timeout(10000) }
        );
        if (upstream.status === 404) return res.json({ status: "success", data: { email, breaches: [] } });
        if (!upstream.ok) {
            return res.status(502).json({ status: "error", message: `HIBP responded with ${upstream.status}` });
        }
        const list = await upstream.json();
        if (!Array.isArray(list)) {
            return res.status(502).json({ status: "error", message: "Breach lookup returned an invalid response" });
        }
        res.json({
            status: "success",
            data: {
                email,
                breaches: list.map((b) => ({
                    name: b.Name,
                    year: new Date(b.BreachDate).getFullYear(),
                    records: `${(b.PwnCount / 1e6).toFixed(1)}M`,
                    type: (b.DataClasses || []).slice(0, 3).join(", "),
                    severity: b.PwnCount > 5e6 ? "CRITICAL" : b.PwnCount > 1e6 ? "HIGH" : "MEDIUM",
                })),
            },
        });
    } catch (error) {
        // Avoid exposing upstream, network, or request details to callers.
        res.status(502).json({ status: "error", message: "Breach lookup failed; please try again later" });
    }
});

/**
 * POST /api/v1/console/analyze — explain the risk of a single message WITHOUT starting a session.
 * Runs the same detection, emotion, extraction and ML layers the honeypot uses, and stores nothing.
 */
router.post("/analyze", analysisRateLimit, async (req, res) => {
    const text = req.body?.message;
    if (typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ status: "error", message: "message (non-empty string) is required" });
    }
    try {
        const message = text.slice(0, 4000);
        const [detection, ml] = await Promise.all([
            detectScamIntent(message, [], {}),
            getMLScamConfidence(message).catch(() => null),
        ]);
        const emotion = detectEmotion(message, []);
        const intel = extractIntelligence(message);
        res.json({
            status: "success",
            data: {
                isScam: Boolean(detection.isScam),
                probability: Math.round((detection.confidence || 0) * 100),
                riskLevel: detection.riskLevel,
                scamType: detection.scamType,
                targetAsset: detection.targetAsset || null,
                reasoning: detection.reasoning || [],
                safetyAdvice: detection.safetyAdvice || [],
                pressureVelocity: detection.pressureVelocity?.velocity || "slow",
                userVulnerability: detection.userVulnerability?.vulnerability || "low",
                vulnerabilityIndicators: detection.userVulnerability?.indicators || [],
                userClaimedLegitimate: Boolean(detection.userClaimedLegitimate),
                patterns: detection.detectedPatterns || [],
                emotion: { name: emotion.emotion, intensity: emotion.intensity },
                extracted: { ...intel, amounts: extractAmounts(message) },
                ml: ml ? { confidence: ml.confidence, category: ml.scam_category, reason: ml.reason } : null,
            },
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to analyze message" });
    }
});

/**
 * GET /api/v1/console/intelligence/summary — everything the honeypot has harvested, across all sessions:
 * UPI IDs, phone numbers, URLs, amounts requested, scam keywords and behavioural tactics, with counts.
 */
router.get("/intelligence/summary", async (req, res) => {
    try {
        const turns = await ConversationTurn.find({ role: "user" })
            .sort({ timestamp: -1 }).limit(5000).select("sessionId text extractedIntel").lean();
        const buckets = {
            upiIds: new Map(), phoneNumbers: new Map(), urls: new Map(), scamPhrases: new Map(), behavioralPatterns: new Map(),
        };
        const amounts = [];
        const bump = (m, k, sid) => {
            const e = m.get(k) || { value: k, count: 0, sessions: new Set() };
            e.count += 1;
            e.sessions.add(sid);
            m.set(k, e);
        };
        for (const t of turns) {
            for (const key of Object.keys(buckets)) {
                (t.extractedIntel?.[key] || []).forEach((v) => bump(buckets[key], v, t.sessionId));
            }
            extractAmounts(t.text).forEach((a) => amounts.push(a));
        }
        const top = (m, n = 15) => [...m.values()].sort((a, b) => b.count - a.count).slice(0, n)
            .map((e) => ({ value: e.value, count: e.count, sessions: e.sessions.size }));
        const sum = amounts.reduce((a, b) => a + b, 0);
        res.json({
            status: "success",
            data: {
                turnsAnalyzed: turns.length,
                totals: Object.fromEntries(Object.entries(buckets).map(([k, m]) => [k, m.size])),
                upiIds: top(buckets.upiIds),
                phoneNumbers: top(buckets.phoneNumbers),
                urls: top(buckets.urls),
                scamPhrases: top(buckets.scamPhrases),
                behavioralPatterns: top(buckets.behavioralPatterns),
                amounts: {
                    count: amounts.length,
                    total: sum,
                    max: amounts.length ? Math.max(...amounts) : 0,
                    average: amounts.length ? Math.round(sum / amounts.length) : 0,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to load intelligence summary" });
    }
});

/**
 * POST /api/v1/console/risk — Risk Fusion Engine. Any combination of { message, url, app, upiIds,
 * phoneNumbers, behavior } → one explainable score with per-signal evidence.
 */
router.post("/risk", async (req, res) => {
    try {
        const body = req.body || {};
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return res.status(400).json({ status: "error", message: "Request body must be a JSON object" });
        }

        const textFields = [
            ["message", 4000],
            ["url", 4096],
            ["app", 300],
        ];
        for (const [field, maxLength] of textFields) {
            const value = body[field];
            if (value !== undefined && value !== null && value !== "" && typeof value !== "string") {
                return res.status(400).json({ status: "error", message: `Field '${field}' must be a string` });
            }
            if (typeof value === "string" && value.length > maxLength) {
                return res.status(413).json({ status: "error", message: `Field '${field}' exceeds ${maxLength} characters` });
            }
        }

        for (const field of ["upiIds", "phoneNumbers"]) {
            const value = body[field];
            if (value === undefined || value === null) continue;
            if (!Array.isArray(value)) {
                return res.status(400).json({ status: "error", message: `Field '${field}' must be an array of strings` });
            }
            if (value.length > 50 || value.some((item) => typeof item !== "string" || item.length > 200)) {
                return res.status(400).json({ status: "error", message: `Field '${field}' must contain at most 50 strings of 200 characters or fewer` });
            }
        }
        if (body.behavior !== undefined && body.behavior !== null) {
            if (typeof body.behavior !== "object" || Array.isArray(body.behavior)) {
                return res.status(400).json({ status: "error", message: "Field 'behavior' must be an object" });
            }
            const behavior = body.behavior;
            const required = ["hour", "amount", "transactions", "new_device", "failed_logins"];
            const missing = required.filter((field) => behavior[field] === undefined);
            if (missing.length) {
                return res.status(400).json({ status: "error", message: `Behavior is missing fields: ${missing.join(", ")}` });
            }
            const integerFields = ["hour", "transactions", "new_device", "failed_logins"];
            if (integerFields.some((field) => !Number.isInteger(behavior[field]))) {
                return res.status(400).json({ status: "error", message: "Behavior hour, counters, and device flag must be integers" });
            }
            if (behavior.hour < 0 || behavior.hour > 23 ||
                behavior.transactions < 0 || behavior.transactions > 1000000 ||
                behavior.failed_logins < 0 || behavior.failed_logins > 1000000 ||
                ![0, 1].includes(behavior.new_device)) {
                return res.status(400).json({ status: "error", message: "Behavior counters or hour are outside supported ranges" });
            }
            if (typeof behavior.amount !== "number" || !Number.isFinite(behavior.amount) ||
                behavior.amount < 0 || behavior.amount > 1e15) {
                return res.status(400).json({ status: "error", message: "Behavior amount must be a finite number from 0 to 1e15" });
            }
        }

        const result = await riskFusion.assess({
            message: body.message, url: body.url, app: body.app,
            upiIds: Array.isArray(body.upiIds) ? body.upiIds : [],
            phoneNumbers: Array.isArray(body.phoneNumbers) ? body.phoneNumbers : [],
            behavior: body.behavior,
        });
        res.json({ status: "success", data: result });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to assess risk" });
    }
});

/** GET /api/v1/console/sessions/:id/killchain — scam stage progression, tactic timeline, adaptation */
router.get("/sessions/:id/killchain", async (req, res) => {
    try {
        const analysis = await killChain.analyzeSession(req.params.id);
        if (!analysis) return res.status(404).json({ status: "error", message: "No scammer messages in this session" });
        res.json({ status: "success", data: analysis });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to analyze session kill chain" });
    }
});

/** GET /api/v1/console/campaigns — sessions grouped by shared infrastructure (potentially linked) */
router.get("/campaigns", async (req, res) => {
    try {
        const rawMinSessions = req.query.minSessions;
        const parsedMinSessions = rawMinSessions === undefined ? 1 : Number(rawMinSessions);
        if (!Number.isInteger(parsedMinSessions) || parsedMinSessions < 1) {
            return res.status(400).json({ status: "error", message: "minSessions must be a positive integer" });
        }
        const minSessions = Math.min(parsedMinSessions, 1000);
        const data = await campaigns.detectCampaigns({ minSessions });
        res.json({ status: "success", count: data.length, data });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to detect campaigns" });
    }
});

/** GET /api/v1/console/stix?sessionId=&download=true — STIX 2.1 bundle of the harvested intelligence */
router.get("/stix", async (req, res) => {
    try {
        const { sessionId, download } = req.query;
        if (sessionId !== undefined && (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 200)) {
            return res.status(400).json({ status: "error", message: "sessionId must be a non-empty string of at most 200 characters" });
        }
        if (download !== undefined && !["true", "false"].includes(download)) {
            return res.status(400).json({ status: "error", message: "download must be true or false" });
        }
        const bundle = await stix.buildBundle({ sessionId });
        res.setHeader("Content-Type", "application/stix+json;version=2.1");
        if (download === "true") res.setHeader("Content-Disposition", "attachment; filename=cyberrakshak_stix_bundle.json");
        res.send(JSON.stringify(bundle, null, 2));
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to build STIX bundle" });
    }
});

/** GET /api/v1/console/incidents — correlated alert incidents; POST .../:id/resolve closes one */
router.get("/incidents", async (req, res) => {
    try {
        const rawLimit = req.query.limit;
        const parsedLimit = rawLimit === undefined ? 30 : Number(rawLimit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
            return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
        }
        const status = req.query.status;
        if (status !== undefined && !["open", "resolved"].includes(status)) {
            return res.status(400).json({ status: "error", message: "status must be open or resolved" });
        }
        const data = await incidents.listIncidents({ limit: Math.min(parsedLimit, 100), status });
        res.json({ status: "success", count: data.length, data });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to list incidents" });
    }
});
router.post("/incidents/:id/resolve", async (req, res) => {
    const incidentId = req.params.id;
    if (typeof incidentId !== "string" || !incidentId.trim() || incidentId.length > 200) {
        return res.status(400).json({ status: "error", message: "A valid incident ID is required" });
    }
    try {
        const doc = await incidents.setStatus(incidentId, "resolved");
        if (!doc) return res.status(404).json({ status: "error", message: "Incident not found" });
        return res.json({ status: "success", data: { incidentId: doc.incidentId, status: doc.status } });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Unable to resolve incident" });
    }
});

/** GET /api/v1/console/sessions?limit=&scam=true — recent honeypot sessions */
router.get("/sessions", async (req, res) => {
    try {
        const rawLimit = req.query.limit;
        const parsedLimit = rawLimit === undefined ? 30 : Number(rawLimit);
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
            return res.status(400).json({ status: "error", message: "limit must be a positive integer" });
        }
        if (req.query.scam !== undefined && !["true", "false"].includes(req.query.scam)) {
            return res.status(400).json({ status: "error", message: "scam must be true or false" });
        }
        const limit = Math.min(parsedLimit, 100);
        const query = req.query.scam === "true" ? { scamEverDetected: true } : {};
        const sessions = await Session.find(query).sort({ lastActiveAt: -1 }).limit(limit).lean();

        const counts = await ConversationTurn.aggregate([
            { $match: { sessionId: { $in: sessions.map((s) => s.sessionId) } } },
            { $group: { _id: "$sessionId", turns: { $sum: 1 } } },
        ]);
        const turnMap = Object.fromEntries(counts.map((c) => [c._id, c.turns]));

        res.json({
            status: "success",
            count: sessions.length,
            data: sessions.map((s) => ({
                sessionId: s.sessionId,
                platform: s.platform,
                sender: s.sender,
                status: s.status,
                scamDetected: Boolean(s.scamEverDetected),
                scamProbability: s.maxScamProbability || 0,
                phase: s.highestPhase || s.engagementPhase || "early",
                scamType: s.scamType || null,
                userVulnerability: s.userVulnerability || "low",
                persona: s.persona?.name || null,
                turns: turnMap[s.sessionId] || 0,
                createdAt: s.createdAt,
                lastActiveAt: s.lastActiveAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to load sessions" });
    }
});

/** GET /api/v1/console/sessions/:id — full session: state, transcript, extracted intelligence */
router.get("/sessions/:id", async (req, res) => {
    try {
        const session = await Session.findOne({ sessionId: req.params.id }).lean();
        if (!session) return res.status(404).json({ status: "error", message: "Session not found" });

        const [turns, intelligence] = await Promise.all([
            getConversationHistory(req.params.id),
            getSessionIntelligence(req.params.id),
        ]);

        res.json({
            status: "success",
            data: {
                session: {
                    sessionId: session.sessionId,
                    platform: session.platform,
                    sender: session.sender,
                    status: session.status,
                    scamDetected: Boolean(session.scamEverDetected),
                    scamProbability: session.maxScamProbability || 0,
                    phase: session.highestPhase || session.engagementPhase || "early",
                    scamType: session.scamType || null,
                    persona: session.persona?.name || null,
                    emotion: session.currentEmotion,
                    fsmState: session.fsmState || null,
                    evasionScore: session.evasionScore || 0,
                    agent: {
                        personaDetail: session.persona || null,
                        emotion: session.currentEmotion,
                        emotionIntensity: session.emotionIntensity || 0,
                        emotionHistory: session.emotionHistory || [],
                        responseMode: session.responseMode,
                        fsmScenario: session.fsmScenario || null,
                        baitUsedCount: session.baitUsedCount || 0,
                        lastBaitType: session.lastBaitType || null,
                        triggeredReveal: Boolean(session.triggeredReveal),
                        userVulnerability: session.userVulnerability || "low",
                        confidenceLocked: Boolean(session.confidenceLocked),
                        finalCallbackSent: Boolean(session.finalCallbackSent),
                        safetyInterventions: session.safetyInterventions || 0,
                        injectionAttempts: session.injectionAttempts || 0,
                    },
                    createdAt: session.createdAt,
                    lastActiveAt: session.lastActiveAt,
                },
                turns: turns.map((t) => ({
                    index: t.turnIndex,
                    role: t.role,
                    text: t.text,
                    timestamp: t.timestamp,
                    scamIntent: t.detectedScamIntent,
                })),
                intelligence,
            },
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to load session details" });
    }
});

/** GET /api/v1/console/sessions/:id/audit — full audit trail of what the agent saw and did */
router.get("/sessions/:id/audit", async (req, res) => {
    try {
        const events = await getSessionAudit(req.params.id);
        res.json({
            status: "success",
            count: events.length,
            data: events.map((e) => ({
                eventType: e.eventType,
                timestamp: e.timestamp,
                incomingMessage: e.incomingMessage,
                outgoingMessage: e.outgoingMessage,
                detection: e.detection,
                intelligence: e.intelligence,
                agentState: e.agentState,
                knownScammer: e.knownScammer,
                safety: e.safety,
            })),
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to load session audit" });
    }
});

/** GET /api/v1/console/audit/stats — platform-wide audit counters */
router.get("/audit/stats", async (req, res) => {
    const stats = await getAuditStats();
    if (!stats) return res.status(500).json({ status: "error", message: "Audit stats unavailable" });
    res.json({ status: "success", data: stats });
});

/** GET /api/v1/console/known-identifiers — the cross-session scammer identifier database (UPI / phone) */
router.get("/known-identifiers", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
        const rows = await ScammerIntelligence.find({}).sort({ lastSeenAt: -1 }).limit(limit).lean();
        res.json({
            status: "success",
            count: rows.length,
            data: rows.map((r) => ({
                id: String(r._id),
                identifier: r.upiId || r.phoneNumber,
                kind: r.upiId ? "UPI" : "PHONE",
                riskLevel: r.riskLevel,
                sessionCount: r.sessionCount,
                scamTypes: r.scamTypes || [],
                averageConfidence: r.averageConfidence,
                isBlacklisted: Boolean(r.isBlacklisted),
                firstSeenAt: r.firstSeenAt,
                lastSeenAt: r.lastSeenAt,
            })),
        });
    } catch (error) {
        res.status(500).json({ status: "error", message: "Unable to load audit statistics" });
    }
});

module.exports = router;
