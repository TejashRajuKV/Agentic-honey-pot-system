// Sprint 6 — failure modes and hostile input.
//   A. ML engine down   B. database down   C. fuzz every write route   D. security basics
// Each scenario runs on its own private gateway (callbacks isolated to a local sink).

const fs = require("fs");
const path = require("path");
const { ROOT, ok, sleep, http, startGateway, discoverRoutes } = require("./harness");

const RUN = `rdy6-${Date.now().toString(36)}`;
const STARTED = new Date();
const UPI = `${RUN}@okaxis`;
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((p) => fs.existsSync(p));
const gateways = [];
const KEY = { "x-api-key": process.env.API_KEY };
let cleanupIds = [];

const timed = async (fn) => { const t0 = Date.now(); const r = await fn(); return { r, ms: Date.now() - t0 }; };

async function run(t) {
    // ══ A. ML engine down ═════════════════════════════════════════════════════
    t.section("A. ML engine unavailable (Flask down)");
    const A = await startGateway(3115, { ML_AUTO_START: "false", CYBERRAKSHAK_URL: "http://127.0.0.1:59998" }, { waitMl: false });
    gateways.push(A);
    const a = (m, p, b, h) => http(m, `${A.base}${p}`, b, h);

    await t.check("gateway still boots and answers; status honestly reports ML offline and platform not operational", async () => {
        const st = (await a("GET", "/api/v1/system/status")).data.data;
        ok(st.ml.reachable === false && st.operational === false, `ml.reachable=${st.ml.reachable} operational=${st.operational}`);
        ok(st.db.connected === true, "database should still be connected");
    });
    await t.check("ML routes fail fast with a JSON 503 (no hang, no stack trace)", async () => {
        for (const [m, p, b] of [["POST", "/api/v1/ml/scam", { message: "x urgent" }], ["POST", "/api/v1/ml/phishing", { url: "http://a.xyz" }], ["GET", "/api/v1/ml/loan/rules"]]) {
            const { r, ms } = await timed(() => a(m, p, b));
            ok(r.status === 503 && /unreachable/i.test(JSON.stringify(r.data)), `${p} → ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
            ok(ms < 10000, `${p} took ${ms}ms`);
        }
    });
    await t.check("honeypot keeps engaging on its rule-based brain and still detects a scam", async () => {
        const r = await a("POST", "/api/v1/console/messages", { sessionId: `${RUN}-noml`, message: `URGENT: your SBI account will be blocked, share OTP now and pay to ${UPI}` });
        cleanupIds.push(`${RUN}-noml`);
        ok(r.status === 200 && r.data.reply, `status ${r.status}`);
        ok(r.data.scamDetected === true, "scam not detected without the ML engine");
        ok(r.data.mlEnrichment === null, "mlEnrichment should be null when the engine is down");
    });
    await t.check("Risk Fusion degrades gracefully: still scores from the signals that are available", async () => {
        const r = await a("POST", "/api/v1/console/risk", { message: "URGENT: pay Rs 5000 now or arrest", url: "http://sbi-kyc.xyz/login", app: "cashnow" });
        ok(r.status === 200, `status ${r.status}`);
        const d = r.data.data;
        ok(d.signals.message && d.riskScore >= 25, `message signal missing / score ${d.riskScore}`);
        ok(!d.signals.url && d.meta.signalsMissing.includes("url"), "URL signal should be reported as missing, not invented");
        ok(d.uncertainty > 0, "uncertainty must reflect the missing signals");
    });
    await t.check("evaluator endpoint keeps working without the ML engine", async () => {
        const r = await a("POST", "/api/v1/messages", { sessionId: `${RUN}-noml2`, message: { sender: "scammer", text: "Your KYC expires today, share OTP" } }, KEY);
        cleanupIds.push(`${RUN}-noml2`);
        ok(r.status === 200 && r.data.status === "success" && r.data.reply, `status ${r.status}`);
    });

    if (CHROME) {
        await t.check("UI with the ML engine down: shows OFFLINE/DEGRADED and clear errors, never a blank page or crash", async () => {
            const puppeteer = require("puppeteer-core");
            const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu"], defaultViewport: { width: 1440, height: 900 } });
            try {
                const page = await browser.newPage();
                const pageErrors = [];
                page.on("pageerror", (e) => pageErrors.push(e.message));
                await page.goto(`${A.base}/`, { waitUntil: "networkidle2", timeout: 30000 });
                await page.waitForFunction(() => !document.querySelector(".boot-overlay"), { timeout: 30000 });
                await page.waitForFunction(() => /OFFLINE/.test(document.querySelector(".status-text")?.textContent || ""), { timeout: 25000 }).catch(() => { throw new Error("navbar did not switch to OFFLINE"); });
                await page.goto(`${A.base}/dashboard`, { waitUntil: "networkidle2" });
                await page.waitForSelector(".tab-item", { timeout: 20000 });
                await page.waitForFunction(() => /DEGRADED/.test(document.body.innerText), { timeout: 25000 }).catch(() => { throw new Error("dashboard header did not show DEGRADED"); });
                // Scam probe must produce a visible error, not a dead click
                await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("PROBE_SIGNATURE_01")).click());
                await page.waitForFunction(() => document.querySelector(".error-box"), { timeout: 20000 }).catch(() => { throw new Error("no error message shown when the ML engine is down"); });
                // every module view must still render (no white screen)
                const count = await page.evaluate(() => document.querySelectorAll(".tab-item").length);
                for (let i = 0; i < count; i++) {
                    await page.evaluate((k) => document.querySelectorAll(".tab-item")[k].click(), i);
                    await sleep(1200);
                    const len = await page.evaluate(() => document.querySelector(".forensic-container-inner")?.innerText.length || 0);
                    ok(len > 30, `module ${i + 1} rendered nothing`);
                }
                ok(!pageErrors.length, `uncaught exceptions: ${pageErrors.join(" | ")}`);
            } finally { await browser.close(); }
        });
    } else t.warn("no Chrome found — UI-with-ML-down check skipped");
    A.stop();

    // ══ B. Database down ══════════════════════════════════════════════════════
    t.section("B. Database unavailable (MongoDB down)");
    const B = await startGateway(3116, { MONGODB_URI: "mongodb://127.0.0.1:1/none?serverSelectionTimeoutMS=1500" }, { waitDb: false });
    gateways.push(B);
    const b = (m, p, body, h) => http(m, `${B.base}${p}`, body, h);
    await sleep(3000);

    await t.check("gateway boots without a database; probes answer and status reports the DB as down", async () => {
        ok((await b("GET", "/ping")).status === 200, "/ping failed");
        ok((await b("GET", "/api/v1/health")).status === 200, "/api/v1/health failed");
        const st = (await b("GET", "/api/v1/system/status")).data.data;
        ok(st.db.connected === false && st.operational === false, `db.connected=${st.db.connected}`);
        ok(st.ml.reachable === true, "ML engine should be unaffected");
    });
    await t.check("stateless features keep working with no database (ML modules, URL/message risk, language)", async () => {
        ok((await b("POST", "/api/v1/ml/scam", { message: "Your KYC will be suspended" })).status === 200, "ML scam failed");
        ok((await b("POST", "/api/v1/ml/phishing", { url: "http://sbi-kyc.xyz" })).status === 200, "phishing failed");
        ok((await b("POST", "/api/v1/language/detect", { text: "abhi otp bhejo" })).status === 200, "language failed");
        ok((await b("POST", "/api/v1/console/analyze", { message: "share otp now" })).status === 200, "analyze failed");
    });
    await t.check("database-backed routes fail FAST with JSON errors (no 30-second hangs, no crash)", async () => {
        for (const [m, p, body] of [["GET", "/api/v1/console/sessions"], ["GET", "/api/v1/analytics/dashboard"], ["GET", "/api/v1/profiles"], ["POST", "/api/v1/console/messages", { sessionId: `${RUN}-nodb`, message: "hello" }]]) {
            const { r, ms } = await timed(() => b(m, p, body));
            ok(r.status >= 400 && r.type.includes("json"), `${p} → ${r.status} ${r.type}`);
            ok(ms < 8000, `${p} hung for ${ms}ms`);
        }
    });
    await t.check("evaluator endpoint still returns a valid 200 reply during a database outage (degraded, never an error)", async () => {
        const { r, ms } = await timed(() => b("POST", "/api/v1/messages", { sessionId: `${RUN}-nodb2`, message: { sender: "scammer", text: "Your account is blocked, share OTP" } }, KEY));
        ok(r.status === 200 && r.data.status === "success" && typeof r.data.reply === "string" && r.data.reply.length > 0, `status ${r.status}: ${JSON.stringify(r.data).slice(0, 140)}`);
        ok(ms < 8000, `took ${ms}ms`);
    });
    B.stop();

    // ══ C. Fuzz every write route ═════════════════════════════════════════════
    t.section("C. Fuzzing: every POST/PUT route with bad bodies must never produce a 5xx");
    const G = await startGateway(3117);
    gateways.push(G);
    const g = (m, p, body, h) => http(m, `${G.base}${p}`, body, h);
    const writes = discoverRoutes().filter((r) => /^(POST|PUT) \/api\/v1\//.test(r) && !/\/ml\//.test(r) && r !== "POST /api/v1/alerts/test");
    const bodies = { "empty object": {}, "wrong types": { message: 12345, sessionId: { a: 1 }, text: [1, 2], url: 5, email: false, upiIds: "notarray", phoneNumbers: 7, behavior: "x" }, "nulls": { message: null, sessionId: null, url: null, email: null, app: null, upiIds: null }, "arrays": [1, 2, 3], "deep nesting": { message: { text: { text: { text: "x" } } }, sessionId: "s" }, "huge strings": { message: "Z".repeat(90000), sessionId: "S".repeat(5000), text: "Z".repeat(90000), url: "http://" + "a".repeat(5000) } };
    await t.check(`fuzzed ${writes.length} write routes × ${Object.keys(bodies).length} bad bodies: no 5xx, always JSON`, async () => {
        const failures = [];
        for (const route of writes) {
            const [method, pattern] = route.split(" ");
            const url = pattern.replace(/:p/g, "fuzz-id");
            for (const [label, body] of Object.entries(bodies)) {
                const r = await g(method, url, body, KEY).catch((e) => ({ status: 0, type: "", data: e.message }));
                if (r.status === 0 || r.status >= 500) failures.push(`${route}  [${label}] → ${r.status} ${typeof r.data === "string" ? r.data.slice(0, 60) : JSON.stringify(r.data).slice(0, 80)}`);
                else if (!r.type.includes("json") && r.status !== 200) failures.push(`${route}  [${label}] → ${r.status} non-JSON (${r.type})`);
            }
        }
        ok(!failures.length, `${failures.length} problem(s):\n${failures.slice(0, 15).join("\n")}`);
    });
    await t.check("ML gateway rejects unknown targets, bad methods and traversal attempts", async () => {
        ok((await g("GET", "/api/v1/ml/admin")).status === 404, "unknown ML target not 404");
        ok((await g("DELETE", "/api/v1/ml/scam")).status === 405 || (await g("DELETE", "/api/v1/ml/scam")).status === 404, "DELETE should be refused");
        const trav = await g("GET", "/api/v1/ml/%2e%2e%2f%2e%2e%2fetc/passwd");
        ok(trav.status === 404, `traversal → ${trav.status}`);
    });
    await t.check("oversized request bodies are refused with a JSON 413", async () => {
        const res = await fetch(`${G.base}/api/v1/console/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "x".repeat(2_000_000) }) });
        ok(res.status === 413 && (res.headers.get("content-type") || "").includes("json"), `status ${res.status}`);
    });

    // ══ D. Security basics ════════════════════════════════════════════════════
    t.section("D. Security basics");
    await t.check("secrets and source are not served (.env, package.json, src/, ml/, node_modules)", async () => {
        for (const p of ["/.env", "/package.json", "/src/server.js", "/ml/app.py", "/node_modules/express/package.json", "/agent/replySafety.js", "/..%2f..%2f.env", "/%2e%2e/%2e%2e/.env", "/reports/", "/.git/config"]) {
            const r = await fetch(`${G.base}${p}`, { headers: { Accept: "text/html" } });
            const body = await r.text();
            ok(!/MONGODB_URI|LLM_API_KEY|API_KEY=|"dependencies"|require\(|mongoose\.connect/.test(body), `${p} exposed source/secrets`);
        }
    });
    await t.check("a session id containing path characters cannot write a report outside the reports folder", async () => {
        const evil = `..${path.sep}..${path.sep}${RUN}-escape`;
        const evil2 = `../../${RUN}-escape2`;
        for (const id of [evil, evil2]) {
            cleanupIds.push(id);
            await g("POST", "/api/v1/console/messages", { sessionId: id, message: `URGENT pay now to ${UPI} or arrest` });
            await g("POST", "/api/v1/reports/generate", { sessionId: id, format: "pdf" });
        }
        await sleep(1500);
        const outside = [path.join(ROOT, `${RUN}-escape`), path.join(ROOT, "..", `${RUN}-escape`)].concat(fs.readdirSync(ROOT).filter((f) => f.includes(RUN)));
        const stray = [...new Set(outside)].filter((p) => fs.existsSync(p));
        const inReports = fs.existsSync(path.join(ROOT, "reports")) ? fs.readdirSync(path.join(ROOT, "reports")).filter((f) => f.includes(RUN)) : [];
        for (const f of stray) { try { fs.rmSync(f, { recursive: true, force: true }); } catch { /* ignore */ } }
        ok(!stray.length, `files were written outside reports/: ${stray.join(", ")}`);
        state_reports = inReports;
    });
    await t.check("responses do not advertise the framework (X-Powered-By) or leak stack traces on errors", async () => {
        const r = await fetch(`${G.base}/api/v1/system/status`);
        if (r.headers.get("x-powered-by")) t.warn(`server sends X-Powered-By: ${r.headers.get("x-powered-by")} (minor information disclosure)`);
        const e = await fetch(`${G.base}/api/v1/console/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
        const txt = await e.text();
        ok(!/\bat\s+.*\(.*\.js:\d+/.test(txt) && !txt.includes("<pre>"), `error response leaks internals: ${txt.slice(0, 120)}`);
    });
    await t.check("CORS is not wide open to arbitrary origins for credentialed requests", async () => {
        const r = await fetch(`${G.base}/api/v1/system/status`, { headers: { Origin: "https://evil.example" } });
        const allow = r.headers.get("access-control-allow-origin");
        const creds = r.headers.get("access-control-allow-credentials");
        if (allow === "*" || allow === "https://evil.example") t.warn(`CORS allows origin '${allow}' (credentials: ${creds || "no"}) — fine for a public API, tighten if the console gets login`);
        ok(!(allow === "https://evil.example" && creds === "true"), "arbitrary origins are allowed WITH credentials");
    });
    await t.check("known gap (documented): browser-facing /api/v1/console/* and analytics routes require no login", async () => {
        const r = await g("GET", "/api/v1/console/sessions");
        if (r.status === 200) t.warn("console/analytics/intelligence/alerts/reports routes are unauthenticated — put the app behind your own auth or network boundary before exposing it publicly");
    });

    t.section("Log check");
    await t.check("no unhandled exceptions or crashes were logged by any scenario gateway", async () => {
        const bad = gateways.flatMap((x) => x.log().split("\n")).filter((l) => /(UnhandledPromiseRejection|Uncaught|TypeError|ReferenceError|is not a function|Cannot read prop|Traceback)/i.test(l));
        ok(!bad.length, [...new Set(bad)].slice(0, 6).join("\n"));
    });
    await t.check("no gateway process died during the scenarios", async () => {
        // startGateway would have thrown; this asserts they are all still answering at the end
        for (const x of [G]) ok((await fetch(`${x.base}/ping`)).ok, "gateway stopped answering");
    });
}
let state_reports = [];

async function cleanup() {
    gateways.forEach((x) => x.stop());
    const mongoose = require("mongoose");
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        const db = mongoose.connection.db;
        const re = new RegExp(RUN);
        // sessions the fuzzers create have fixed ids ("s", "fuzz-id", a run of "S") — remove them too
        const fuzzIds = /^(s|fuzz-id|S{20,})$/;
        const auto = (await db.collection("sessions").find({ sessionId: /^auto_/, createdAt: { $gte: STARTED } }).project({ sessionId: 1 }).toArray()).map((x) => x.sessionId);   // ids generated for id-less fuzz requests
        for (const c of ["sessions", "conversationturns", "qualitymetrics", "auditlogs"]) await db.collection(c).deleteMany({ $or: [{ sessionId: re }, { sessionId: fuzzIds }, { sessionId: { $in: auto } }] });
        await db.collection("scammerprofiles").deleteMany({ "identifiers.upiIds": UPI });
        await db.collection("scammerintelligences").deleteMany({ upiId: UPI });
        await db.collection("incidents").deleteMany({ $or: [{ sessionIds: re }, { "identifiers.upiIds": UPI }] });
        await db.collection("alertconfigs").updateMany({}, { $pull: { history: { sessionId: re } } });
        const dir = path.join(ROOT, "reports");
        if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.includes(RUN) || /^scam_report_(s|fuzz-id)_\d+\.pdf$/.test(f)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } finally { await mongoose.disconnect().catch(() => {}); }
}

module.exports = { run, cleanup, title: "Sprint 6 — failure modes & hostile input" };
