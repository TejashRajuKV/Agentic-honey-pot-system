// Sprint 3 — frontend ↔ backend wiring.
//   A. Static:   every API call in the frontend source matches a real backend route (and vice-versa).
//   B. Contracts: every response field the UI actually reads is present in the live response.
//
// A mismatch here is exactly the class of bug that shows up as a blank panel or a crashed page.

const fs = require("fs");
const path = require("path");
const { ROOT, ok, sleep, http, walk, discoverRoutes, startGateway, hasPath } = require("./harness");

const feSrc = path.join(ROOT, "frontend", "src");
const rd = (rel) => fs.readFileSync(path.join(feSrc, rel), "utf8");
const norm = (p) => p.replace(/\$\{[^}]+\}/g, ":p").replace(/\?.*$/, "").replace(/\/+$/, "");

// ── A. Extract every API call the frontend makes ─────────────────────────────
function frontendCalls() {
    const calls = new Map(); // "METHOD /path" -> source file
    const add = (method, p, file) => calls.set(`${method} ${norm(p)}`, file);

    // endpoints.js: NAME -> path  (`${V1}/ml/scam` style)
    const ep = rd("api/endpoints.js");
    const V1 = (ep.match(/const V1\s*=\s*["']([^"']+)["']/) || [])[1] || "/api/v1";
    const names = {};
    for (const m of ep.matchAll(/^\s*([A-Z_]+):\s*`([^`]+)`/gm)) names[m[1]] = m[2].replace("${V1}", V1);

    for (const file of walk(feSrc, (p) => /\.jsx?$/.test(p))) {
        const src = fs.readFileSync(file, "utf8");
        const rel = path.relative(feSrc, file).replace(/\\/g, "/");
        // api.get/post(ENDPOINTS.NAME ...)
        for (const m of src.matchAll(/\b(?:api|axios|client)\.(get|post|put|delete)\(\s*ENDPOINTS\.([A-Z_]+)/g)) add(m[1].toUpperCase(), names[m[2]], rel);
        // honeypotApi client with baseURL /api/v1
        if (rel === "api/honeypotApi.js") {
            for (const m of src.matchAll(/client\.(get|post|put|delete)\(\s*[`"']([^`"']+)[`"']/g)) add(m[1].toUpperCase(), `/api/v1${m[2]}`, rel);
            for (const m of src.matchAll(/=>\s*`(\/api\/v1[^`]+)`/g)) add("GET", m[1], rel);   // download links (pdf/json/stix/export)
        }
        // direct axios/fetch with a literal /api path
        for (const m of src.matchAll(/\b(?:axios|fetch)(?:\.(get|post|put|delete))?\(\s*[`"'](\/api\/[^`"']+)[`"']/g)) add((m[1] || "get").toUpperCase(), m[2], rel);
    }
    return calls;
}

function backendRoutes() {
    const routes = new Set(discoverRoutes().filter((r) => !/\/\*$/.test(r)));
    const mlSrc = fs.readFileSync(path.join(ROOT, "src", "routes", "ml.js"), "utf8");
    const allowed = [...mlSrc.match(/new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const postOnly = new Set(["scam", "behavior", "fakenews", "phishing", "loan", "threat"]);
    for (const sub of allowed) {
        if (postOnly.has(sub)) routes.add(`POST /api/v1/ml/${sub}`);
        else routes.add(`GET /api/v1/ml/${sub}`);
    }
    return routes;
}

// Routes intentionally not used by the console UI
const NOT_FOR_UI = new Set([
    "GET /", "GET /ping", "GET /api/v1/ping", "GET /api/v1/health",                    // infrastructure probes
    "GET /api/v1/messages", "POST /api/v1/messages", "GET /api/v1/sessions/:p",        // GUVI evaluator API (x-api-key)
    "GET /api/v1/profiles/:p",                                                          // superseded in the UI by /intelligence/profile/:id
    "GET /api/v1/ml/health", "GET /api/v1/ml/version",                                  // covered by /system/status
]);

// ── B. Response contracts: what each screen reads ────────────────────────────
const MSG_FIELDS = ["status", "reply", "scamDetected", "scamProbability", "phase", "scamType", "reasoning[]", "safetyAdvice[]", "pressureVelocity", "userVulnerability", "targetAsset", "mlEnrichment.mlCategory"];
const ML_RESULT = ["label", "confidence", "risk_color", "reason", "flagged_words[]", "explanation.template", "explanation.tip"];   // <ResultPanel/> destructures these

async function run(t) {
    t.section("A. Static wiring: frontend API calls ↔ backend routes");
    const calls = frontendCalls();
    const routes = backendRoutes();

    await t.check(`extracted ${calls.size} distinct API calls from the frontend source`, async () => {
        ok(calls.size >= 45, `only found ${calls.size} calls — the extractor may be broken`);
    });

    await t.check("every API call the frontend makes matches a real backend route (method + path)", async () => {
        const dead = [...calls.entries()].filter(([c]) => !routes.has(c)).map(([c, f]) => `${c}   (called from ${f})`);
        ok(!dead.length, `frontend calls with no backend route:\n${dead.join("\n")}`);
    });

    await t.check("every backend route is either used by the UI or explicitly marked as non-UI", async () => {
        const orphans = [...routes].filter((r) => !calls.has(r) && !NOT_FOR_UI.has(r));
        ok(!orphans.length, `backend features with no UI (add a screen, or list under NOT_FOR_UI with a reason):\n${orphans.join("\n")}`);
    });

    await t.check("the frontend contains no hardcoded backend host or port", async () => {
        const bad = [];
        for (const f of walk(feSrc, (p) => /\.jsx?$/.test(p))) {
            const s = fs.readFileSync(f, "utf8");
            const m = s.match(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/);
            if (m) bad.push(`${path.relative(feSrc, f)}: ${m[0]}`);
        }
        ok(!bad.length, bad.join("\n"));
    });

    t.section("B. Live contracts: fields the UI reads exist in real responses");
    const gw = await startGateway(3112);
    t.gw = gw;
    const V = `${gw.base}/api/v1`;
    const get = (p) => http("GET", `${V}${p}`);
    const post = (p, b) => http("POST", `${V}${p}`, b ?? {});
    const RUN = `rdy3-${Date.now().toString(36)}`;
    t.runId = RUN;
    const SID = `${RUN}-a`;
    const UPI = `${RUN}@okaxis`;

    await t.check("seed: engagement creates a session with UPI, phone and link", async () => {
        for (const m of [
            "Hello sir, I am calling from SBI bank regarding your account.",
            `URGENT: pay Rs 5000 to ${UPI} or call +91 9811100044 now, account will be blocked. Link http://sbi-${RUN}.xyz/verify`,
        ]) {
            const r = await post("/console/messages", { sessionId: SID, message: m });
            ok(r.status === 200, `status ${r.status}`);
            t.lastMessage = r.data;
        }
        await sleep(4000);
    });

    let profileId;
    const first = async (p, key = "data") => { const r = await get(p); ok(r.status === 200, `${p} → ${r.status}`); return key ? r.data[key] : r.data; };

    // [description, fetcher, [required paths]]
    const contracts = [
        ["console/messages response (Live Engagement panel)", async () => t.lastMessage, MSG_FIELDS],
        ["console/sessions list (Conversations / Reports / Archetypes)", async () => (await first("/console/sessions?limit=100")), ["[].sessionId", "[].platform", "[].scamDetected", "[].scamProbability", "[].turns", "[].lastActiveAt", "[].scamType", "[].userVulnerability", "[].persona", "[].phase"]],
        ["console/sessions/:id (case file)", () => first(`/console/sessions/${SID}`), ["session.sessionId", "session.platform", "session.status", "session.scamDetected", "session.scamProbability", "session.scamType", "session.phase", "session.fsmState", "session.persona", "session.createdAt", "session.evasionScore", "session.agent.personaDetail", "session.agent.responseMode", "session.agent.baitUsedCount", "session.agent.emotionHistory", "session.agent.triggeredReveal", "session.agent.userVulnerability", "session.agent.confidenceLocked", "session.agent.finalCallbackSent", "session.agent.safetyInterventions", "session.agent.injectionAttempts", "turns[].index", "turns[].role", "turns[].text", "turns[].timestamp", "intelligence.upiIds", "intelligence.phoneNumbers", "intelligence.urls", "intelligence.scamPhrases", "intelligence.behavioralPatterns"]],
        ["console/sessions/:id/killchain (Kill-chain panel)", () => first(`/console/sessions/${SID}/killchain`), ["stages[].id", "stages[].label", "stagesReached", "peakStage", "stageProgress", "pressure.curve", "pressure.trend", "pressure.peak", "adaptation.escalations", "adaptation.tacticSwitches", "adaptation.score", "adaptation.note", "timeline[].turn", "timeline[].timestamp", "timeline[].stage", "timeline[].tactics", "timeline[].text"]],
        ["console/sessions/:id/audit (Audit trail)", () => first(`/console/sessions/${SID}/audit`), ["[].eventType", "[].timestamp"]],
        ["console/audit/stats (Overview)", () => first("/console/audit/stats"), ["totalSessions", "scamsDetected", "baitsDeployed", "repeatScammers"]],
        ["console/risk (Risk Fusion)", async () => (await post("/console/risk", { message: `URGENT pay Rs 5000 to ${UPI}`, url: "http://sbi-kyc.xyz/login", app: "cashnow" })).data.data, ["riskScore", "confidence", "uncertainty", "verdict", "category", "recommendedAction", "breakdown[].signal", "breakdown[].score", "breakdown[].weight", "breakdown[].points", "evidence[].type", "evidence[].detail", "evidence[].points", "extracted.upiIds", "extracted.phoneNumbers", "extracted.urls", "extracted.amounts", "meta.engine", "meta.signalsMissing"]],
        ["console/analyze (safety advice)", async () => (await post("/console/analyze", { message: "share your OTP now" })).data.data, ["isScam", "probability", "riskLevel", "scamType", "reasoning", "safetyAdvice", "pressureVelocity", "userVulnerability", "vulnerabilityIndicators", "userClaimedLegitimate", "emotion.name", "emotion.intensity", "extracted.upiIds", "extracted.amounts", "extracted.scamPhrases"]],
        ["console/intelligence/summary (Harvested Indicators)", () => first("/console/intelligence/summary"), ["turnsAnalyzed", "totals.upiIds", "totals.phoneNumbers", "totals.urls", "totals.scamPhrases", "totals.behavioralPatterns", "upiIds[].value", "upiIds[].count", "upiIds[].sessions", "phoneNumbers", "urls", "scamPhrases", "behavioralPatterns", "amounts.count", "amounts.total", "amounts.max", "amounts.average"]],
        ["console/known-identifiers (Identifier Database)", () => first("/console/known-identifiers"), ["[].id", "[].identifier", "[].kind", "[].riskLevel", "[].sessionCount", "[].scamTypes", "[].isBlacklisted", "[].lastSeenAt"]],
        ["console/campaigns (Campaigns)", () => first("/console/campaigns"), ["[].campaignId", "[].linked", "[].sessions", "[].scamType", "[].dominantTactics", "[].identifiers.upiIds", "[].identifiers.phoneNumbers", "[].identifiers.domains", "[].firstSeen", "[].lastSeen", "[].activeDays", "[].maxRisk", "[].linkEvidence", "[].caveat", "[].sessionIds"]],
        ["console/incidents (Alerts → Incidents)", () => first("/console/incidents"), ["[].incidentId", "[].title", "[].status", "[].severity", "[].sessions", "[].identifiers.upiIds", "[].identifiers.phoneNumbers", "[].eventCount", "[].alertsSent", "[].alertsSuppressed", "[].maxRisk", "[].lastEventAt"]],
        ["system/status (navbar, Home, Integrations)", () => first("/system/status"), ["api.uptimeSec", "ml.reachable", "ml.latencyMs", "ml.pid", "ml.modules", "ml.managed", "ml.restarts", "db.connected", "db.latencyMs", "db.sessions", "db.scamSessions", "agent.mode", "agent.llmConfigured", "alerts.channels", "alerts.webhookConfigured", "integrations.evaluatorApiKeyConfigured", "integrations.finalCallbackConfigured", "integrations.breachLookupConfigured", "operational"]],
        ["analytics/dashboard (Overview)", () => first("/analytics/dashboard"), ["today.sessions", "today.scams", "today.confidence", "today.quality", "totals.sessions", "totals.scams", "totals.scammers", "totals.detectionRate"]],
        ["analytics/heatmap", () => first("/analytics/heatmap"), ["data", "labels.days", "labels.hours", "totalScams"]],
        ["analytics/trends", () => first("/analytics/trends?days=30"), ["[].pattern", "[].totalFrequency", "[].avgConfidence"]],
        ["analytics/top-scammers (Overview)", () => first("/analytics/top-scammers?limit=5"), ["[].profileId", "[].identifiers", "[].riskScore", "[].lastSeen", "[].psychologicalProfile.primaryTactic", "[].psychologicalProfile.sophistication"]],
        ["analytics/language-stats", () => first("/analytics/language-stats?days=30"), ["counts.english", "percentages.english", "total"]],
        ["profiles list (Profiles, Archetypes)", async () => { const l = await first("/profiles?limit=100"); profileId = l.find((p) => p.identifiers?.upiIds?.includes(UPI))?.profileId; ok(profileId, "no profile for seeded UPI"); return l; }, ["[].profileId", "[].identifiers.upiIds", "[].identifiers.phoneNumbers", "[].riskScore", "[].lastSeen", "[].psychologicalProfile.primaryTactic", "[].psychologicalProfile.sophistication", "[].behavioralFingerprint.pressureVelocity", "[].behavioralFingerprint.emotionSignature.primaryEmotion"]],
        ["intelligence/profile/:id (Profile detail)", () => first(`/intelligence/profile/${profileId}`), ["profile.id", "profile.riskScore", "profile.status", "profile.firstSeen", "profile.lastSeen", "profile.identifiers.upiIds", "psychological.primaryTactic", "psychological.sophistication", "psychological.adaptability", "psychological.persistenceScore", "psychological.manipulationTechniques", "behavioral.pressureVelocity", "behavioral.emotionSignature.primaryEmotion", "behavioral.timePatterns.activeHours", "behavioral.avgMessageLength", "behavioral.pressureTactics", "behavioral.signaturePhrases", "sessions.total", "sessions.details[].sessionId"]],
        ["profiles/match/:id", () => first(`/profiles/match/${profileId}`), ["[].profileId", "[].similarity", "[].sharedTraits"]],
        ["intelligence/network", () => first("/intelligence/network"), ["statistics.totalProfiles", "statistics.totalConnections", "statistics.avgConnectionsPerProfile", "edges"]],
        ["intelligence/check (Known threat lookup)", async () => (await post("/intelligence/check", { upiIds: [UPI] })).data.data, ["isKnownThreat", "matches.intelligence[].riskLevel", "matches.intelligence[].sessionCount", "matches.profiles"]],
        ["alerts/config (Alerts form)", () => first("/alerts/config"), ["enabled", "triggers.criticalRisk", "channels", "filters.minRiskScore", "filters.scamTypes", "filters.rateLimit.maxAlertsPerHour", "filters.rateLimit.maxAlertsPerDay", "auth.type", "retryConfig.enabled", "retryConfig.maxRetries"]],
        ["alerts/stats", () => first("/alerts/stats"), ["total", "successful", "failed", "successRate", "retries", "deadLetters", "latency"]],
        ["alerts/history", () => first("/alerts/history"), ["[].type", "[].timestamp", "[].delivered"]],
        ["quality/metrics (Quality Scores, Overview)", () => first("/quality/metrics"), ["totalEvaluations", "averageScores.naturalness", "averageScores.coherence", "averageScores.relevance", "averageScores.strategicValue", "averageScores.overall", "recentMetrics[].scores.overall", "recentMetrics[].analysis.agentMessage", "recentMetrics[].analysis.scammerMessage", "recentMetrics[].sessionId"]],
        ["quality/session/:id", () => first(`/quality/session/${SID}`), ["[].turnNumber", "[].scores.overall", "[].analysis.agentMessage"]],
        ["quality/report/:id", () => first(`/quality/report/${SID}`), ["totalTurns", "averageScores.overall", "averageScores.naturalness", "averageScores.strategicValue", "recommendation.level", "recommendation.message"]],
        ["quality/repetition/:id", () => first(`/quality/repetition/${SID}`), ["hasRepetition", "count"]],
        ["reports/:id/timeline", () => first(`/reports/${SID}/timeline`), ["[].turn", "[].role", "[].preview"]],
        ["reports/list", () => first("/reports/list"), []],
        ["language/detect", async () => (await post("/language/detect", { text: "aapka account block ho jayega" })).data.data, ["language", "confidence"]],
        ["language/analyze-hinglish", async () => (await post("/language/analyze-hinglish", { text: "abhi OTP bhejo" })).data.data, ["isHinglish", "hinglishPhrases", "scamIndicators[].severity", "scamIndicators[].type", "scamIndicators[].pattern"]],
        ["language/scam-phrases", () => first("/language/scam-phrases"), []],
        ["reports/generate", async () => (await post("/reports/generate", { sessionId: SID, format: "pdf" })).data.data, ["filename", "size"]],
    ];

    for (const [name, fetcher, paths] of contracts) {
        await t.check(name, async () => {
            const body = await fetcher();
            const missing = [];
            for (const p of paths) {
                const r = hasPath(body, p);
                if (!r.ok) missing.push(`${p} → ${r.why}`);
            }
            ok(!missing.length, `UI reads fields that the API does not return:\n${missing.join("\n")}`);
        });
    }

    t.section("B2. ML module responses (rendered by <ResultPanel/> and module-specific panels)");
    const mlCases = [
        ["ml/scam → Scam Radar", () => post("/ml/scam", { message: "Your KYC will be suspended. Update immediately." }), [...ML_RESULT, "scam_category", "scam_category_color"]],
        ["ml/behavior → Behavior Anomaly", () => post("/ml/behavior", { hour: 3, amount: 90000, transactions: 20, new_device: 1, failed_logins: 5 }), ML_RESULT],
        ["ml/fakenews → Fake News", () => post("/ml/fakenews", { text: "Forwarded many times: govt giving free Rs 5000, forward to 10 people" }), [...ML_RESULT, "forward_detection.is_forwarded", "forward_detection.viral_risk", "forward_detection.forward_indicators"]],
        ["ml/phishing → Phishing", () => post("/ml/phishing", { url: "http://sbi-kyc-update.xyz/login" }), [...ML_RESULT, "signals[].signal", "signals[].points", "signals[].detail", "registered_domain"]],
        ["ml/loan → Loan Apps", () => post("/ml/loan", { instant_approval: true, no_rbi_registration: true, app_name: "cashnow" }), [...ML_RESULT, "app_database.db_status", "app_database.app_name", "app_database.message"]],
        ["ml/threat → Multi-Vector", () => post("/ml/threat", { message: "share your OTP", url: "http://sbi-kyc.xyz/login", app: "cashnow" }), ["overall_label", "overall_color", "overall_confidence", "threat_count", "threats[].type", "threats[].icon", "threats[].color", "threats[].reason", "safe"]],
        ["ml/loan/rules → weights shown in Loan Apps", () => http("GET", `${V}/ml/loan/rules`), ["no_rbi_registration.score", "no_rbi_registration.reason", "too_many_permissions.score"]],
        ["ml/loan/check-app → quick lookup", () => http("GET", `${V}/ml/loan/check-app?name=cashnow`), ["db_status", "app_name", "message"]],
    ];
    for (const [name, fn, paths] of mlCases) {
        await t.check(name, async () => {
            const r = await fn();
            ok(r.status === 200, `status ${r.status}`);
            const missing = paths.map((p) => [p, hasPath(r.data, p)]).filter(([, x]) => !x.ok).map(([p, x]) => `${p} → ${x.why}`);
            ok(!missing.length, `missing fields:\n${missing.join("\n")}`);
            if (paths.includes("label")) ok(typeof r.data.label === "string" && typeof r.data.reason === "string", "label/reason must be strings (ResultPanel calls .toUpperCase()/.split())");
            if (paths.includes("confidence")) ok(Number.isFinite(r.data.confidence) && r.data.confidence >= 0 && r.data.confidence <= 100, `confidence out of range: ${r.data.confidence}`);
        });
    }

    t.section("Log check");
    await t.check("no server errors were logged while the contracts were exercised", async () => {
        const bad = gw.log().split("\n").filter((l) => /\b(TypeError|ReferenceError|is not a function|Cannot read prop|MongoServerError|Traceback|post-process \[)/i.test(l) || /^\s*Error:/.test(l));
        ok(!bad.length, bad.slice(0, 6).join("\n"));
    });
}

async function cleanup(t) {
    if (t.gw) t.gw.stop();
    if (!t.runId) return;
    const mongoose = require("mongoose");
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        const db = mongoose.connection.db;
        const re = new RegExp(`^${t.runId}`);
        const upi = `${t.runId}@okaxis`;
        for (const c of ["sessions", "conversationturns", "qualitymetrics", "auditlogs"]) await db.collection(c).deleteMany({ sessionId: re });
        await db.collection("scammerprofiles").deleteMany({ "identifiers.upiIds": upi });
        await db.collection("scammerintelligences").deleteMany({ upiId: upi });
        await db.collection("incidents").deleteMany({ $or: [{ "identifiers.upiIds": upi }, { sessionIds: re }] });
        await db.collection("alertconfigs").updateMany({}, { $pull: { history: { sessionId: re } } });
        const dir = path.join(ROOT, "reports");
        if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.includes(t.runId)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } finally { await mongoose.disconnect().catch(() => {}); }
}

module.exports = { run, cleanup, title: "Sprint 3 — frontend ↔ backend wiring" };
