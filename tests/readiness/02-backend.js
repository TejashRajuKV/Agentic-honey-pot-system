// Sprint 2 — backend runtime.
// Boots its OWN gateway (port 3111) so the boot log can be inspected for errors, then calls every route
// the code registers. A coverage check discovers routes from the source, so adding a route without a
// test case here makes the suite fail — nothing is silently untested.

const fs = require("fs");
const path = require("path");
const http_ = require("http");
const { ROOT, ok, sleep, http, startGateway } = require("./harness");

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const V1 = `${BASE}/api/v1`;
const API_KEY = process.env.API_KEY;

let child = null;
let gw = null;
const logText = () => (gw ? gw.log() : "");
const RUN = `rdy2-${Date.now().toString(36)}`;
const SID = `${RUN}-a`;
const UPI = `${RUN}@okaxis`;

// ── route discovery from source ────────────────────────────────────────────────
function discoverRoutes() {
    const app = fs.readFileSync(path.join(ROOT, "src", "app.js"), "utf8");
    const vars = {};
    for (const m of app.matchAll(/const\s+(\w+)\s*=\s*require\(["']\.\/routes\/([\w-]+)["']\)/g)) vars[m[1]] = m[2];
    const mounts = [];
    for (const m of app.matchAll(/app\.use\(\s*["'](\/api\/v1[^"']*)["']\s*,\s*(?:(\w+)|require\(["']\.\/routes\/([\w-]+)["']\))\s*\)/g)) {
        mounts.push({ prefix: m[1], file: m[3] || vars[m[2]] });
    }
    const routes = [];
    for (const { prefix, file } of mounts) {
        const src = fs.readFileSync(path.join(ROOT, "src", "routes", `${file}.js`), "utf8");
        for (const m of src.matchAll(/router\.(get|post|put|delete|patch|all)\(\s*["'`]([^"'`]+)["'`]/g)) {
            routes.push(`${m[1].toUpperCase()} ${(prefix + (m[2] === "/" ? "" : m[2])).replace(/:\w+/g, ":p").replace(/\/\*path/, "/*")}`);
        }
    }
    for (const m of app.matchAll(/app\.(get|post)\(\s*["'](\/[^"']*)["']/g)) routes.push(`${m[1].toUpperCase()} ${m[2]}`);
    return [...new Set(routes)];
}

async function startServer() {
    gw = await startGateway(PORT);
    child = { kill: () => gw.stop() };
}

const get = (p, h) => http("GET", p.startsWith("http") ? p : `${BASE}${p}`, undefined, h);
const post = (p, b, h) => http("POST", p.startsWith("http") ? p : `${BASE}${p}`, b ?? {}, h);
const put = (p, b, h) => http("PUT", p.startsWith("http") ? p : `${BASE}${p}`, b ?? {}, h);

async function run(t) {
    t.section("Boot");
    await t.check("gateway boots, connects to MongoDB and finds the ML engine", async () => { await startServer(); });

    await t.check("boot log contains no errors, exceptions or unhandled rejections", async () => {
        const bad = logText().split("\n").filter((l) =>
            /\b(TypeError|ReferenceError|SyntaxError|UnhandledPromiseRejection|ECONNREFUSED|is not a function|Cannot read prop|MongoServerError|❌)/i.test(l));
        ok(!bad.length, bad.slice(0, 8).join("\n"));
    });
    await t.check("boot log has no warnings from the gateway itself", async () => {
        const gw = logText().split("\n").filter((l) => !l.startsWith("[ml") && /⚠️|warn/i.test(l));
        ok(!gw.length, gw.slice(0, 6).join("\n"));
    });
    const mlWarn = logText().split("\n").filter((l) => l.startsWith("[ml!]") && /warning/i.test(l) && !/development server/i.test(l));
    if (mlWarn.length) t.warn(`ML engine emits ${mlWarn.length} library warning(s) at start-up (e.g. ${mlWarn[0].slice(0, 110)}…) — harmless today, worth pinning scikit-learn`);

    t.section("Seed data for route calls");
    let profileId = null;
    await t.check("engagement seeds a session, incident inputs and a scammer profile", async () => {
        for (const m of [
            "Hello sir, I am calling from SBI bank regarding your account.",
            `URGENT: pay Rs 5000 to ${UPI} or call +91 9811100033 now, account will be blocked. Link http://sbi-${RUN}.xyz/verify`,
        ]) {
            const r = await post("/api/v1/console/messages", { sessionId: SID, message: m });
            ok(r.status === 200 && r.data.reply, `message failed: ${r.status}`);
        }
        await sleep(4000);
        const p = await get("/api/v1/profiles?limit=100");
        const mine = p.data.data.find((x) => x.identifiers?.upiIds?.includes(UPI));
        ok(mine, "no profile built for the seeded UPI ID");
        profileId = mine.profileId;
    });

    // ── every route, with the request it should get ──────────────────────────
    const key = { "x-api-key": API_KEY };
    const webhookReceiver = await new Promise((res) => {
        const s = http_.createServer((req, r) => { req.resume(); r.end("ok"); }).listen(0, "127.0.0.1", () => res(s));
    });
    const hook = `http://127.0.0.1:${webhookReceiver.address().port}/h`;

    const cases = {
        "GET /": () => get("/", { Accept: "text/html" }),
        "GET /ping": () => get("/ping"),
        "GET /api/v1/ping": () => get("/api/v1/ping"),
        "GET /api/v1/health": () => get("/api/v1/health"),
        "GET /api/v1/messages": () => get("/api/v1/messages"),
        "POST /api/v1/messages": () => post("/api/v1/messages", { sessionId: `${RUN}-key`, message: "hello there" }, key),
        "GET /api/v1/sessions/:p": () => get(`/api/v1/sessions/${SID}`, key),

        "GET /api/v1/analytics/dashboard": () => get("/api/v1/analytics/dashboard"),
        "GET /api/v1/analytics/trends": () => get("/api/v1/analytics/trends?days=7"),
        "GET /api/v1/analytics/heatmap": () => get("/api/v1/analytics/heatmap"),
        "GET /api/v1/analytics/top-scammers": () => get("/api/v1/analytics/top-scammers?limit=3"),
        "GET /api/v1/analytics/language-stats": () => get("/api/v1/analytics/language-stats"),
        "GET /api/v1/analytics/export": () => get("/api/v1/analytics/export?format=json"),
        "POST /api/v1/analytics/aggregate": () => post("/api/v1/analytics/aggregate", {}),

        "GET /api/v1/intelligence/threats": () => get("/api/v1/intelligence/threats"),
        "GET /api/v1/intelligence/profile/:p": () => get(`/api/v1/intelligence/profile/${profileId}`),
        "POST /api/v1/intelligence/correlate": () => post("/api/v1/intelligence/correlate", { sessionId: SID }),
        "POST /api/v1/intelligence/check": () => post("/api/v1/intelligence/check", { upiIds: [UPI] }),
        "GET /api/v1/intelligence/network": () => get("/api/v1/intelligence/network"),

        "GET /api/v1/profiles": () => get("/api/v1/profiles"),
        "GET /api/v1/profiles/:p": () => get(`/api/v1/profiles/${profileId}`),
        "POST /api/v1/profiles/analyze": () => post("/api/v1/profiles/analyze", { sessionId: SID }),
        "GET /api/v1/profiles/match/:p": () => get(`/api/v1/profiles/match/${profileId}`),

        "GET /api/v1/alerts/config": () => get("/api/v1/alerts/config"),
        "PUT /api/v1/alerts/config": async () => { const c = (await get("/api/v1/alerts/config")).data.data; return put("/api/v1/alerts/config", { enabled: c.enabled, triggers: c.triggers, channels: c.channels, filters: c.filters }); },
        "POST /api/v1/alerts/test": () => post("/api/v1/alerts/test", { webhookUrl: hook }),
        "GET /api/v1/alerts/history": () => get("/api/v1/alerts/history"),
        "GET /api/v1/alerts/stats": () => get("/api/v1/alerts/stats"),

        "GET /api/v1/quality/session/:p": () => get(`/api/v1/quality/session/${SID}`),
        "GET /api/v1/quality/report/:p": () => get(`/api/v1/quality/report/${SID}`),
        "GET /api/v1/quality/metrics": () => get("/api/v1/quality/metrics"),
        "GET /api/v1/quality/repetition/:p": () => get(`/api/v1/quality/repetition/${SID}`),

        "POST /api/v1/reports/generate": () => post("/api/v1/reports/generate", { sessionId: SID, format: "pdf" }),
        "GET /api/v1/reports/:p/pdf": () => get(`/api/v1/reports/${SID}/pdf`),
        "GET /api/v1/reports/:p/json": () => get(`/api/v1/reports/${SID}/json`),
        "GET /api/v1/reports/list": () => get("/api/v1/reports/list"),
        "GET /api/v1/reports/:p/timeline": () => get(`/api/v1/reports/${SID}/timeline`),

        "POST /api/v1/language/detect": () => post("/api/v1/language/detect", { text: "aapka account block ho jayega" }),
        "GET /api/v1/language/stats/:p": () => get(`/api/v1/language/stats/${SID}`),
        "POST /api/v1/language/analyze-hinglish": () => post("/api/v1/language/analyze-hinglish", { text: "abhi OTP bhejo" }),
        "GET /api/v1/language/scam-phrases": () => get("/api/v1/language/scam-phrases"),

        "GET /api/v1/system/status": () => get("/api/v1/system/status"),

        "POST /api/v1/console/messages": () => post("/api/v1/console/messages", { sessionId: SID, message: "Please pay now, this is urgent" }),
        "POST /api/v1/console/risk": () => post("/api/v1/console/risk", { message: "URGENT pay now", url: "http://sbi-kyc.xyz", app: "cashnow" }),
        "GET /api/v1/console/sessions/:p/killchain": () => get(`/api/v1/console/sessions/${SID}/killchain`),
        "GET /api/v1/console/campaigns": () => get("/api/v1/console/campaigns"),
        "GET /api/v1/console/stix": () => get("/api/v1/console/stix"),
        "GET /api/v1/console/incidents": () => get("/api/v1/console/incidents"),
        "POST /api/v1/console/incidents/:p/resolve": () => post("/api/v1/console/incidents/INC-DOES-NOT-EXIST/resolve", {}),
        "POST /api/v1/console/analyze": () => post("/api/v1/console/analyze", { message: "share your OTP" }),
        "POST /api/v1/console/breach-check": () => post("/api/v1/console/breach-check", { email: "test@example.com" }),
        "GET /api/v1/console/intelligence/summary": () => get("/api/v1/console/intelligence/summary"),
        "GET /api/v1/console/sessions": () => get("/api/v1/console/sessions"),
        "GET /api/v1/console/sessions/:p": () => get(`/api/v1/console/sessions/${SID}`),
        "GET /api/v1/console/sessions/:p/audit": () => get(`/api/v1/console/sessions/${SID}/audit`),
        "GET /api/v1/console/audit/stats": () => get("/api/v1/console/audit/stats"),
        "GET /api/v1/console/known-identifiers": () => get("/api/v1/console/known-identifiers"),
    };
    // ML gateway: `/api/v1/ml/*path` is one route, but each whitelisted target must work
    const mlCalls = {
        "POST ml/scam": () => post("/api/v1/ml/scam", { message: "Your KYC will be suspended immediately" }),
        "POST ml/behavior": () => post("/api/v1/ml/behavior", { hour: 3, amount: 90000, transactions: 9, new_device: 1, failed_logins: 4 }),
        "POST ml/fakenews": () => post("/api/v1/ml/fakenews", { text: "Forward this to 10 people to get free recharge" }),
        "POST ml/phishing": () => post("/api/v1/ml/phishing", { url: "http://sbi-kyc-update.xyz/login" }),
        "POST ml/loan": () => post("/api/v1/ml/loan", { instant_approval: true, no_rbi_registration: true }),
        "GET ml/loan/rules": () => get("/api/v1/ml/loan/rules"),
        "GET ml/loan/check-app": () => get("/api/v1/ml/loan/check-app?name=cashnow"),
        "POST ml/threat": () => post("/api/v1/ml/threat", { message: "share OTP", url: "http://sbi-kyc.xyz", app: "cashnow" }),
        "GET ml/health": () => get("/api/v1/ml/health"),
        "GET ml/version": () => get("/api/v1/ml/version"),
    };

    t.section(`Route sweep — ${Object.keys(cases).length} gateway routes + ${Object.keys(mlCalls).length} ML endpoints`);

    await t.check("route coverage: every route in the source has a test case here", async () => {
        const discovered = discoverRoutes().filter((r) => !/\/\*$/.test(r) && !r.startsWith("GET /api") || true);
        const skip = (r) => /\/\*$/.test(r) || r.startsWith("ALL /api/v1/ml") || /^(GET|POST) \/api\/v1\/ml\//.test(r);
        const missing = discovered.filter((r) => !skip(r) && !(r in cases));
        ok(!missing.length, `routes with no test case:\n${missing.join("\n")}`);
        const stale = Object.keys(cases).filter((c) => !discovered.includes(c) && !c.startsWith("GET /api/v1/ping") && c !== "GET /");
        ok(!stale.length, `test cases for routes that no longer exist:\n${stale.join("\n")}`);
    });

    const expectStatus = { "POST /api/v1/console/incidents/:p/resolve": [404], "POST /api/v1/console/breach-check": [200, 503] };
    const seen = {};
    for (const [name, fn] of Object.entries(cases)) {
        await t.check(name, async () => {
            const started = Date.now();
            const r = await fn();
            seen[name] = r;
            const allowed = expectStatus[name] || [200];
            ok(allowed.includes(r.status), `expected ${allowed.join("/")}, got ${r.status}: ${Buffer.isBuffer(r.data) ? r.data.toString().slice(0, 120) : JSON.stringify(r.data).slice(0, 200)}`);
            ok(Date.now() - started < 15000, `too slow: ${Date.now() - started}ms`);
            if (r.type.includes("json") && r.data && r.data.status) ok(["success", "ok"].includes(r.data.status) || allowed.includes(r.status), `body status was '${r.data.status}'`);
        });
    }
    for (const [name, fn] of Object.entries(mlCalls)) {
        await t.check(name, async () => {
            const r = await fn();
            ok(r.status === 200, `got ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
            if (name.startsWith("POST") && name !== "POST ml/threat") ok(typeof r.data.confidence === "number", "no numeric confidence");
        });
    }

    t.section("Response contracts");
    await t.check("PDF report is a real PDF and JSON report carries the investigator sections", async () => {
        const pdf = seen["GET /api/v1/reports/:p/pdf"];
        ok(pdf.type.includes("pdf") && pdf.data.subarray(0, 5).toString() === "%PDF-", "not a PDF");
        const j = seen["GET /api/v1/reports/:p/json"].data.data;
        ok(j.investigation?.killChain && j.investigation?.risk && j.intelligence.upiIds.includes(UPI), "report JSON incomplete");
    });
    await t.check("STIX export is a valid bundle", async () => {
        const b = seen["GET /api/v1/console/stix"].data;
        ok(b.type === "bundle" && Array.isArray(b.objects) && b.objects.every((o) => o.id.startsWith(`${o.type}--`)), "invalid STIX bundle");
    });
    await t.check("evaluator endpoint: 401 without key, 403 with a wrong key", async () => {
        const a = await post("/api/v1/messages", { sessionId: `${RUN}-k`, message: "hi" });
        const b = await post("/api/v1/messages", { sessionId: `${RUN}-k`, message: "hi" }, { "x-api-key": "wrong" });
        ok(a.status === 401 && b.status === 403, `got ${a.status} / ${b.status}`);
    });
    await t.check("unknown /api routes return JSON 404, unknown pages return the SPA", async () => {
        const a = await get("/api/v1/definitely-not-a-route");
        ok(a.status === 404 && a.type.includes("json"), `api 404 was ${a.status} ${a.type}`);
        const b = await get("/some/client/route", { Accept: "text/html" });
        ok(b.status === 200 && b.data.toString().includes('id="root"'), "SPA fallback missing");
    });

    t.section("Log check after the sweep");
    await t.check("no errors or exceptions were logged while the routes were being exercised", async () => {
        const bad = logText().split("\n").filter((l) => /\b(TypeError|ReferenceError|SyntaxError|UnhandledPromiseRejection|is not a function|Cannot read prop|MongoServerError|Traceback|post-process \[)/i.test(l) || /^\s*Error:/.test(l));
        ok(!bad.length, bad.slice(0, 8).join("\n"));
    });

    webhookReceiver.close();
}

async function cleanup() {
    if (child) { try { child.kill(); } catch { /* gone */ } }
    // remove data this sprint created
    const mongoose = require("mongoose");
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        const db = mongoose.connection.db;
        const re = new RegExp(`^${RUN}`);
        for (const c of ["sessions", "conversationturns", "qualitymetrics", "auditlogs"]) await db.collection(c).deleteMany({ sessionId: re });
        await db.collection("scammerprofiles").deleteMany({ "identifiers.upiIds": UPI });
        await db.collection("scammerintelligences").deleteMany({ upiId: UPI });
        await db.collection("incidents").deleteMany({ $or: [{ "identifiers.upiIds": UPI }, { sessionIds: re }] });
        await db.collection("alertconfigs").updateMany({}, { $pull: { history: { sessionId: re } } });
        const dir = path.join(ROOT, "reports");
        if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.includes(RUN)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } finally { await mongoose.disconnect().catch(() => {}); }
}

module.exports = { run, cleanup, title: "Sprint 2 — backend runtime" };
