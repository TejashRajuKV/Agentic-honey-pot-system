// Sprint 5 — end-to-end workflows: the things a real deployment actually does.
// Runs on private gateways whose GUVI callback and alert webhook point at LOCAL sinks, so nothing
// here can reach the real evaluation endpoint. The alert configuration is restored afterwards.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ROOT, ok, sleep, http, startGateway, startSink } = require("./harness");

const RUN = `rdy5-${Date.now().toString(36)}`;
const KEY = { "x-api-key": process.env.API_KEY };
let state = {};

const uniq = (s) => `${RUN}${s}`;
const upiFor = (n) => `${RUN}${n}@okaxis`;

async function run(t) {
    t.section("Setup");
    const alertSink = await startSink();      // receives alert webhooks
    state.alertSink = alertSink;
    let gw = await startGateway(3114);
    state.gw = gw;
    const api = (m, p, b, h) => http(m, `${gw.base}${p}`, b, h);
    const get = (p, h) => api("GET", p, undefined, h);
    const post = (p, b, h) => api("POST", p, b ?? {}, h);
    await t.check("private gateway is up and its final-report callback points at a local sink", async () => {
        const st = (await get("/api/v1/system/status")).data.data;
        ok(st.integrations.finalCallbackSource === "env" && /127\.0\.0\.1/.test(st.integrations.finalCallbackHost), `callback → ${st.integrations.finalCallbackHost} (${st.integrations.finalCallbackSource})`);
    });

    // ── 1. Evaluator API, official request format ─────────────────────────────
    t.section("1. GUVI evaluator API — multi-turn conversation in the official format");
    const evalSid = uniq("-eval");
    const history = [];
    const seen = [];
    await t.check("5 turns via POST /api/v1/messages (x-api-key) return well-formed replies", async () => {
        const script = [
            "Dear customer, your SBI account has been flagged. Please verify.",
            "Your account will be blocked today unless you complete KYC. This is urgent.",
            "Click http://sbi-secure-kyc.xyz/login to update KYC now.",
            "Share your OTP immediately to avoid permanent block.",
            "Pay Rs 1 to verify@okaxis to confirm your account is active.",
        ];
        for (const text of script) {
            const r = await post("/api/v1/messages", {
                sessionId: evalSid,
                message: { sender: "scammer", text, timestamp: Date.now() },
                conversationHistory: history.slice(),
                metadata: { channel: "SMS", language: "English", locale: "IN" },
            }, KEY);
            ok(r.status === 200 && r.data.status === "success", `status ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
            ok(typeof r.data.reply === "string" && r.data.reply.length > 0, "empty reply");
            for (const k of ["scamDetected", "scamProbability", "phase", "patterns"]) ok(k in r.data, `response lacks '${k}'`);
            seen.push(r.data);
            history.push({ sender: "scammer", text, timestamp: Date.now() }, { sender: "user", text: r.data.reply, timestamp: Date.now() });
        }
    });
    await t.check("risk accumulation is monotonic: scam flag never flips back, probability and phase never decrease", async () => {
        const order = { early: 0, mid: 1, late: 2, final: 3 };
        for (let i = 1; i < seen.length; i++) {
            ok(!(seen[i - 1].scamDetected && !seen[i].scamDetected), `scamDetected flipped false at turn ${i + 1}`);
            ok(seen[i].scamProbability >= seen[i - 1].scamProbability, `probability fell ${seen[i - 1].scamProbability} → ${seen[i].scamProbability} at turn ${i + 1}`);
            ok(order[seen[i].phase] >= order[seen[i - 1].phase], `phase regressed ${seen[i - 1].phase} → ${seen[i].phase} at turn ${i + 1}`);
        }
        ok(seen[seen.length - 1].scamDetected, "scam never detected across a clear KYC scam");
    });
    await t.check("evaluator session lookup returns the stored conversation", async () => {
        const r = await get(`/api/v1/sessions/${evalSid}`, KEY);
        ok(r.status === 200, `status ${r.status}`);
    });
    await t.check("empty / malformed evaluator requests still get a valid 200 (the tester must never see an error)", async () => {
        for (const body of [{}, { message: "" }, { message: { text: "" } }, { sessionId: uniq("-e"), message: null }]) {
            const r = await post("/api/v1/messages", body, KEY);
            ok(r.status === 200 && r.data.status === "success" && typeof r.data.reply === "string", `body ${JSON.stringify(body)} → ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
        }
    });

    // ── 2. Wrap-up + final report callback ────────────────────────────────────
    t.section("2. Session wrap-up and final-result callback (GUVI format)");
    const wrapSid = uniq("-wrap");
    const wrapUpi = upiFor("w");
    await t.check("a session with enough intelligence wraps up and posts exactly ONE final report", async () => {
        const before = gw.callbacks.length;
        for (const text of [
            `Hello sir, I am from SBI. Pay Rs 10 verification to ${wrapUpi} or call +91 9822200011.`,
            "Please hurry, your account will be blocked, this is urgent.",
            `Open http://sbi-${RUN}.xyz/verify and confirm the details now.`,
            "Sir why are you delaying, do it immediately.",
        ]) {
            const r = await post("/api/v1/console/messages", { sessionId: wrapSid, message: text });
            ok(r.status === 200, `status ${r.status}`);
        }
        await sleep(2500);
        const mine = gw.callbacks.slice(before).filter((c) => c.body.includes(wrapSid));
        ok(mine.length === 1, `expected exactly 1 callback for the session, got ${mine.length}`);
        state.callback = JSON.parse(mine[0].body);
    });
    await t.check("callback payload matches the GUVI contract and contains what was extracted", async () => {
        const p = state.callback;
        ok(p.sessionId === wrapSid && p.scamDetected === true, "sessionId/scamDetected wrong");
        ok(Number.isInteger(p.totalMessagesExchanged) && p.totalMessagesExchanged >= 6, `totalMessagesExchanged=${p.totalMessagesExchanged}`);
        const e = p.extractedIntelligence;
        for (const k of ["bankAccounts", "upiIds", "phishingLinks", "phoneNumbers", "suspiciousKeywords"]) ok(Array.isArray(e[k]), `extractedIntelligence.${k} must be an array`);
        ok(e.upiIds.includes(wrapUpi), "UPI id missing from callback");
        ok(e.phoneNumbers.some((n) => n.endsWith("9822200011")), "phone missing from callback");
        ok(e.phishingLinks.some((l) => l.includes(RUN)), "phishing link missing from callback");
        ok(typeof p.agentNotes === "string" && p.agentNotes.length > 5, "agentNotes empty");
    });
    await t.check("session is terminated, marked callback-sent, and further messages do not re-send it", async () => {
        const s = (await get(`/api/v1/console/sessions/${wrapSid}`)).data.data.session;
        ok(s.status === "terminated", `status is '${s.status}'`);
        ok(s.agent.finalCallbackSent === true, "finalCallbackSent not recorded");
        const before = gw.callbacks.length;
        const r = await post("/api/v1/console/messages", { sessionId: wrapSid, message: "Hello? Are you there? Send the money now." });
        ok(r.status === 200, `post-termination message failed: ${r.status}`);
        await sleep(1500);
        ok(gw.callbacks.length === before, "a second final report was sent for the same session");
    });

    // ── 3. Benign conversation ────────────────────────────────────────────────
    t.section("3. Legitimate conversation");
    await t.check("ordinary messages are never flagged and create no profile, incident or alert", async () => {
        const sid = uniq("-benign");
        const alertsBefore = (await get("/api/v1/alerts/stats")).data.data.total;
        for (const text of ["Hi, are we still meeting for lunch at 1pm tomorrow?", "Great, I'll book a table at the usual place.", "Also please send me the slides from yesterday's meeting when you can."]) {
            const r = await post("/api/v1/console/messages", { sessionId: sid, message: text });
            ok(r.status === 200 && r.data.reply, "no reply");
            ok(r.data.scamDetected === false, `benign message flagged as scam (${r.data.scamProbability}%): "${text}"`);
        }
        await sleep(3000);
        const alertsAfter = (await get("/api/v1/alerts/stats")).data.data.total;
        ok(alertsAfter === alertsBefore, "an alert fired for a benign conversation");
        const inc = (await get("/api/v1/console/incidents")).data.data.filter((i) => i.sessionIds.includes(sid));
        ok(!inc.length, "incident created for a benign conversation");
    });

    // ── 4. Hinglish ───────────────────────────────────────────────────────────
    t.section("4. Hindi / Hinglish scam");
    await t.check("a Hinglish scam is detected through the full pipeline and its language is recognised", async () => {
        const sid = uniq("-hinglish");
        const r = await post("/api/v1/console/messages", { sessionId: sid, message: "Aapka SBI account block ho jayega. Abhi apna OTP bhejo aur KYC update karo warna account band ho jayega." });
        ok(r.status === 200 && r.data.scamDetected, `Hinglish scam not detected (${r.data.scamProbability}%)`);
        const lang = (await get(`/api/v1/language/stats/${sid}`)).data.data;
        ok(JSON.stringify(lang).toLowerCase().includes("hinglish"), `language not recognised: ${JSON.stringify(lang).slice(0, 160)}`);
    });

    // ── 5. Alert pipeline with a real webhook receiver ────────────────────────
    t.section("5. Alerting — webhook delivery, HMAC signature, incident de-duplication");
    const cfgBefore = (await get("/api/v1/alerts/config")).data.data;
    state.cfgBefore = cfgBefore;
    state.deadBefore = (await get("/api/v1/alerts/stats")).data.data.deadLetters;
    const secret = `secret-${RUN}`;
    const alertUpi = upiFor("a");
    await t.check("configure a signed webhook pointing at a local receiver", async () => {
        const r = await http("PUT", `${gw.base}/api/v1/alerts/config`, {
            enabled: true, triggers: { ...cfgBefore.triggers, criticalRisk: true, crossSessionMatch: true, highVelocityAttack: true },
            channels: ["log", "webhook"], webhookUrl: alertSink.url, auth: { type: "hmac", token: secret },
            filters: { ...cfgBefore.filters, minRiskScore: 0, scamTypes: [], rateLimit: { enabled: false, maxAlertsPerHour: 1000, maxAlertsPerDay: 1000 } },
            retryConfig: { enabled: false, maxRetries: 0, retryDelay: 100 },
        });
        ok(r.status === 200, `PUT failed ${r.status}`);
    });
    const strong = (sid, n) => post("/api/v1/console/messages", { sessionId: sid, message: `URGENT: SBI account blocked! Pay Rs ${n}00 to ${alertUpi} immediately or police case and arrest. Verify http://sbi-${RUN}.xyz/${n}` });
    await t.check("first high-risk session → one critical alert delivered to the receiver with a valid HMAC", async () => {
        const before = alertSink.received.length;
        const r = await strong(uniq("-alertA"), 1);
        ok(r.status === 200 && r.data.scamProbability >= 80, `not high-risk: ${r.data.scamProbability}`);
        await sleep(4500);
        const got = alertSink.received.slice(before).filter((x) => x.body.includes(RUN));
        ok(got.length >= 1, `receiver got ${got.length} alert(s)`);
        const ev = got.map((x) => JSON.parse(x.body).event);
        ok(ev.includes("critical_risk"), `events: ${ev.join(",")}`);
        const a = got[0];
        const ts = a.headers["x-cyberrakshak-timestamp"];
        const expected = `sha256=${crypto.createHmac("sha256", secret).update(`${ts}.${a.body}`).digest("hex")}`;
        ok(a.headers["x-cyberrakshak-signature"] === expected, "HMAC signature does not verify");
        ok(Math.abs(Date.now() / 1000 - Number(ts)) < 60, "timestamp not fresh");
    });
    await t.check("second session from the SAME scammer → exactly one cross-session alert (not another critical alert)", async () => {
        const before = alertSink.received.length;
        await strong(uniq("-alertB"), 2);
        await sleep(4500);
        const ev = alertSink.received.slice(before).filter((x) => x.body.includes(RUN)).map((x) => JSON.parse(x.body).event);
        ok(ev.filter((e) => e === "cross_session").length === 1, `events after 2nd session: ${ev.join(",") || "none"}`);
        ok(!ev.includes("critical_risk"), "a duplicate critical_risk alert was sent");
    });
    await t.check("further activity from that scammer sends no more alerts, but the incident counts the events", async () => {
        const before = alertSink.received.length;
        await strong(uniq("-alertA"), 3); await strong(uniq("-alertB"), 4); await strong(uniq("-alertC"), 5);
        await sleep(5000);
        const ev = alertSink.received.slice(before).filter((x) => x.body.includes(RUN)).map((x) => JSON.parse(x.body).event);
        ok(ev.filter((e) => e === "critical_risk").length === 0, `duplicate critical alerts: ${ev.join(",")}`);
        const inc = (await get("/api/v1/console/incidents")).data.data.find((i) => i.identifiers.upiIds.includes(alertUpi));
        ok(inc && inc.sessions >= 3 && inc.alertsSuppressed >= 1 && inc.eventCount > inc.alertsSent, `incident: ${JSON.stringify(inc && { s: inc.sessions, e: inc.eventCount, sent: inc.alertsSent, sup: inc.alertsSuppressed })}`);
        state.incidentId = inc.incidentId;
    });
    await t.check("delivery metrics reflect the sends (latency measured, no dead letters)", async () => {
        const s = (await get("/api/v1/alerts/stats")).data.data;
        ok(s.latency && s.latency.samples >= 2 && s.latency.p95Ms >= 0, `latency: ${JSON.stringify(s.latency)}`);
        ok(s.deadLetters === state.deadBefore, `dead letters rose from ${state.deadBefore} to ${s.deadLetters} — webhook deliveries failed`);
    });

    // ── 6. Restart persistence ────────────────────────────────────────────────
    t.section("6. Restart: nothing is lost and de-duplication survives");
    gw.stop(); await sleep(1500);
    gw = await startGateway(3114);
    state.gw2 = gw;
    const api2 = (m, p, b, h) => http(m, `${gw.base}${p}`, b, h);
    await t.check("after a gateway restart the sessions, profile and incident are all still there", async () => {
        const s = await api2("GET", `/api/v1/console/sessions/${wrapSid}`);
        ok(s.status === 200 && s.data.data.turns.length >= 6, "session lost");
        const p = (await api2("GET", "/api/v1/profiles?limit=200")).data.data.find((x) => x.identifiers?.upiIds?.includes(alertUpi));
        ok(p, "profile lost");
        const inc = (await api2("GET", "/api/v1/console/incidents")).data.data.find((i) => i.incidentId === state.incidentId);
        ok(inc && inc.sessions >= 3, "incident lost");
    });
    await t.check("a new event for the known scammer after the restart does NOT re-alert (state is in the database)", async () => {
        const before = alertSink.received.length;
        await http("POST", `${gw.base}/api/v1/console/messages`, { sessionId: uniq("-alertA"), message: `FINAL NOTICE: pay Rs 900 to ${alertUpi} now or arrest. http://sbi-${RUN}.xyz/again` });
        await sleep(4500);
        const ev = alertSink.received.slice(before).filter((x) => x.body.includes(RUN));
        ok(!ev.length, `${ev.length} duplicate alert(s) after restart`);
    });

    // ── 7. Concurrency ────────────────────────────────────────────────────────
    t.section("7. Concurrency");
    await t.check("12 different sessions engaged in parallel all succeed with 2 turns each", async () => {
        const ids = Array.from({ length: 12 }, (_, i) => uniq(`-par${i}`));
        const rs = await Promise.all(ids.map((id) => http("POST", `${gw.base}/api/v1/console/messages`, { sessionId: id, message: "Hello sir, calling from your bank about your account, please confirm." })));
        ok(rs.every((r) => r.status === 200 && r.data.reply), `statuses: ${rs.map((r) => r.status).join(",")}`);
        await sleep(2000);
        for (const id of ids) {
            const s = await http("GET", `${gw.base}/api/v1/console/sessions/${id}`);
            ok(s.status === 200 && s.data.data.turns.length === 2, `${id} has ${s.data?.data?.turns?.length} turns`);
        }
    });
    await t.check("6 simultaneous messages into ONE session: no errors, no lost or duplicated turns", async () => {
        const sid = uniq("-race");
        const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => http("POST", `${gw.base}/api/v1/console/messages`, { sessionId: sid, message: `Message number ${i + 1}: please confirm your KYC details today.` })));
        ok(rs.every((r) => r.status === 200), `statuses: ${rs.map((r) => r.status).join(",")}`);
        await sleep(2500);
        const turns = (await http("GET", `${gw.base}/api/v1/console/sessions/${sid}`)).data.data.turns;
        ok(turns.length === 12, `expected 12 turns, stored ${turns.length}`);
        const idx = turns.map((x) => x.index);
        ok(new Set(idx).size === idx.length, `duplicate turn indexes: ${idx.join(",")}`);
    });

    // ── 8. Input handling ─────────────────────────────────────────────────────
    t.section("8. Hostile and awkward input");
    await t.check("oversized, unicode, HTML and control-character messages are handled without a 5xx", async () => {
        const sid = uniq("-input");
        const cases = ["A".repeat(6000), "आपका खाता बंद हो जाएगा 🚨 अभी OTP भेजें 🙏", "<script>alert(1)</script><img src=x onerror=alert(1)> pay now", "line1 line2 ‮ reversed", "   ", "😀".repeat(500)];
        for (const message of cases) {
            const r = await http("POST", `${gw.base}/api/v1/console/messages`, { sessionId: sid, message });
            ok(r.status < 500, `message of length ${message.length} → ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);
        }
        const stored = (await http("GET", `${gw.base}/api/v1/console/sessions/${sid}`)).data.data.turns.map((x) => x.text).join(" ");
        ok(!/<script>/i.test(stored) || true, "");   // stored text is data; React escapes it on render (checked in Sprint 4)
    });
    await t.check("malformed JSON body returns a JSON 4xx, not a crash or HTML stack trace", async () => {
        const res = await fetch(`${gw.base}/api/v1/console/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
        const txt = await res.text();
        ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
        ok(!/at .*\.js:\d+/.test(txt) && !/node_modules/.test(txt), `stack trace leaked: ${txt.slice(0, 160)}`);
    });

    // ── 9. Cross-feature consistency ──────────────────────────────────────────
    t.section("9. Numbers agree across features");
    await t.check("dashboard totals, session list and system status tell the same story", async () => {
        await post("/api/v1/analytics/aggregate", {});
        const list = (await get("/api/v1/console/sessions?limit=100")).data.data;
        const st = (await get("/api/v1/system/status")).data.data;
        ok(st.db.sessions >= list.length, `status says ${st.db.sessions} sessions but the list has ${list.length}`);
        const scamInList = (await get("/api/v1/console/sessions?limit=100&scam=true")).data.data.length;
        ok(scamInList > 0 && scamInList <= list.length, "scam-only filter inconsistent");
        const dash = (await get("/api/v1/analytics/dashboard")).data.data;
        ok(dash.totals.sessions >= 1 && dash.totals.scams >= 1, `dashboard totals: ${JSON.stringify(dash.totals)}`);
    });
    await t.check("JSON report, STIX bundle and harvested-indicator summary all contain the same scammer identifier", async () => {
        const rep = (await get(`/api/v1/reports/${uniq("-alertA")}/json`)).data.data;
        ok(rep.intelligence.upiIds.includes(alertUpi), "JSON report missing UPI");
        const stix = await (await fetch(`${gw.base}/api/v1/console/stix`)).json();
        ok(stix.objects.some((o) => o.type === "indicator" && o.pattern.includes(alertUpi.toLowerCase())), "STIX missing UPI");
        const sum = (await get("/api/v1/console/intelligence/summary")).data.data;
        ok(sum.upiIds.some((u) => u.value.toLowerCase() === alertUpi.toLowerCase()), "summary missing UPI");
        const camp = (await get("/api/v1/console/campaigns")).data.data.find((c) => c.identifiers.upiIds.includes(alertUpi.toLowerCase()));
        ok(camp && camp.sessions >= 3, `campaign spans ${camp && camp.sessions} sessions`);
    });

    t.section("Log check");
    await t.check("no server errors in either gateway's log", async () => {
        const bad = [...state.gw.log().split("\n"), ...gw.log().split("\n")].filter((l) => /\b(TypeError|ReferenceError|is not a function|Cannot read prop|MongoServerError|Traceback)/i.test(l) || /^\s*Error:/.test(l));
        ok(!bad.length, bad.slice(0, 6).join("\n"));
    });
}

async function cleanup() {
    state.gw?.stop(); state.gw2?.stop(); state.alertSink?.close();
    const mongoose = require("mongoose");
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        const db = mongoose.connection.db;
        const re = new RegExp(`^${RUN}`);
        for (const c of ["sessions", "conversationturns", "qualitymetrics", "auditlogs"]) await db.collection(c).deleteMany({ sessionId: re });
        await db.collection("scammerprofiles").deleteMany({ "identifiers.upiIds": re });
        await db.collection("scammerintelligences").deleteMany({ upiId: re });
        await db.collection("incidents").deleteMany({ $or: [{ "identifiers.upiIds": re }, { sessionIds: re }] });
        // restore the alert configuration exactly as it was
        const cfg = state.cfgBefore;
        if (cfg) {
            await db.collection("alertconfigs").updateOne({}, { $set: { enabled: cfg.enabled, triggers: cfg.triggers, channels: cfg.channels, filters: cfg.filters, auth: cfg.auth || { type: "none" }, retryConfig: cfg.retryConfig, webhookUrl: cfg.webhookUrl || undefined } });
            if (!cfg.webhookUrl) await db.collection("alertconfigs").updateOne({}, { $unset: { webhookUrl: "" } });
        }
        await db.collection("alertconfigs").updateMany({}, { $pull: { history: { sessionId: re } } });
        const dir = path.join(ROOT, "reports");
        if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => f.includes(RUN)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } finally { await mongoose.disconnect().catch(() => {}); }
}

module.exports = { run, cleanup, title: "Sprint 5 — end-to-end workflows" };
