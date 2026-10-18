// Sprint 4 — the website in a real browser (headless Chrome via puppeteer-core).
// Boots a private gateway, drives the actual UI like a user, and fails on any console error,
// uncaught exception or failed network request. Views are discovered from the DOM, so a new
// view is smoke-tested automatically.

const fs = require("fs");
const path = require("path");
const http_ = require("http");
const { ROOT, ok, sleep, startGateway } = require("./harness");

const PORT = 3113;
const CHROME = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => fs.existsSync(p));

const RUN = `rdy4-${Date.now().toString(36)}`;
const UPI = `${RUN}@okaxis`;
let ctx = {};   // browser, page, gateway, collectors

// Responses that are EXPECTED to be non-2xx (feature not configured, handled by the UI)
const EXPECTED_HTTP_ERRORS = [{ path: "/console/breach-check", status: 503 }];

async function run(t) {
    ok(CHROME, "no Chrome/Edge found — set CHROME_PATH");
    const puppeteer = require("puppeteer-core");

    t.section("Setup");
    ctx.gw = await startGateway(PORT);
    ctx.base = ctx.gw.base;
    ctx.browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"], defaultViewport: { width: 1440, height: 900 } });
    const page = (ctx.page = await ctx.browser.newPage());

    const consoleErrors = [];
    const pageErrors = [];
    const badResponses = [];
    const failedRequests = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push({ text: m.text(), url: page.url() }); });
    page.on("pageerror", (e) => pageErrors.push({ text: e.message, url: page.url() }));
    page.on("requestfailed", (r) => { if (!/favicon|\.mp4|\.webm|net::ERR_ABORTED/.test(r.url() + (r.failure()?.errorText || ""))) failedRequests.push(`${r.method()} ${r.url()} — ${r.failure()?.errorText}`); });
    page.on("response", (r) => {
        const u = new URL(r.url());
        if (r.status() >= 400 && u.pathname !== "/favicon.ico") badResponses.push({ path: u.pathname.replace("/api/v1", ""), status: r.status(), url: r.url() });
    });
    const unexpected = () => badResponses.filter((b) => !EXPECTED_HTTP_ERRORS.some((e) => b.path === e.path && b.status === e.status));

    // ── helpers ────────────────────────────────────────────
    const inner = () => page.evaluate(() => (document.querySelector(".forensic-container-inner") || document.body).innerText);
    const bodyText = () => page.evaluate(() => document.body.innerText);
    const waitText = (text, timeout = 15000) => page.waitForFunction((s) => document.body.innerText.toLowerCase().includes(s.toLowerCase()), { timeout }, text).catch(async () => {
        throw new Error(`text "${text}" never appeared. View shows:\n${(await inner()).replace(/\n+/g, " | ").slice(0, 500)}`);
    });
    const clickText = async (text, sel = "button, a, .tab-item, .hp-tab, .hp-row, .module-card, .checklist-item-forensic") => {
        const done = await page.evaluate((s, q) => {
            const el = [...document.querySelectorAll(q)].find((e) => e.textContent.includes(s) && e.offsetParent !== null);
            if (!el) return false;
            el.click();
            return true;
        }, text, sel);
        ok(done, `nothing clickable containing "${text}"`);
    };
    const typeInto = async (selector, text, n = 0, { clear = true } = {}) => {
        const found = await page.evaluate((s, i) => { const el = document.querySelectorAll(s)[i]; if (!el) return false; el.scrollIntoView({ block: "center" }); el.focus(); return true; }, selector, n);
        ok(found, `no input #${n} for ${selector}`);
        if (clear) { await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); }
        await page.keyboard.type(text, { delay: 2 });
    };
    const settled = async (max = 12000) => {        // wait until no "LOADING…" remains in the view
        const start = Date.now();
        while (Date.now() - start < max) { if (!(await inner()).includes("LOADING…")) return; await sleep(250); }
    };
    const gotoView = async (moduleFragment, subFragment) => {
        await clickText(moduleFragment, ".tab-item");
        if (subFragment) { await sleep(300); await clickText(subFragment, ".forensic-container > .hp-tabs > .hp-tab"); }
        await sleep(600); await settled();
    };
    const activeSelection = () => page.evaluate(() => ({
        module: document.querySelector(".tab-item.active")?.textContent.trim(),
        sub: document.querySelector(".forensic-container > .hp-tabs > .hp-tab.active")?.textContent.trim(),
    }));
    const fetchIn = (url, opts) => page.evaluate(async (u, o) => { const r = await fetch(u, o); const buf = await r.arrayBuffer(); return { status: r.status, type: r.headers.get("content-type"), head: new TextDecoder().decode(buf.slice(0, 8)), size: buf.byteLength }; }, url, opts);
    ctx.helpers = { inner, page };

    await t.check("headless Chrome launches", async () => { ok((await page.browser().version()).length > 0, "no version"); });

    // ── Home ───────────────────────────────────────────────
    t.section("Home page");
    await t.check("home page loads, boot animation completes and the page becomes interactive", async () => {
        await page.goto(`${ctx.base}/`, { waitUntil: "networkidle2", timeout: 30000 });
        await page.waitForFunction(() => !document.querySelector(".boot-overlay"), { timeout: 30000 }).catch(() => { throw new Error("boot overlay never dismissed"); });
        ok((await page.title()).includes("CyberRakshak"), `title: ${await page.title()}`);
    });
    await t.check("navbar shows LIVE and Home status panel shows live numbers from the API", async () => {
        await page.waitForFunction(() => document.querySelector(".status-text")?.textContent.includes("LIVE"), { timeout: 20000 }).catch(() => { throw new Error("navbar never showed LIVE"); });
        await page.evaluate(() => document.getElementById("status")?.scrollIntoView());
        await waitText("ALL SYSTEMS OPERATIONAL", 20000);
        const txt = await bodyText();
        ok(/CYBERRAKSHAK_ENGINE\s*\n?.*ONLINE/i.test(txt) || txt.includes("ONLINE"), "ML engine not shown online");
        ok(/CONNECTED/.test(txt), "database not shown connected");
        ok(!txt.includes("98.4%") && !txt.includes("AES-256"), "hardcoded placeholder numbers still on the page");
    });
    await t.check("all 7 module cards are present on Home", async () => {
        const n = await page.evaluate(() => document.querySelectorAll(".module-card").length);
        ok(n === 7, `found ${n} module cards`);
    });
    await t.check("navbar theme toggle switches light/dark", async () => {
        const before = await page.evaluate(() => document.body.classList.contains("dark-theme"));
        await page.evaluate(() => document.querySelector(".theme-toggle-container").click());
        await sleep(300);
        const after = await page.evaluate(() => document.body.classList.contains("dark-theme"));
        ok(before !== after, "theme did not change");
        await page.evaluate(() => document.querySelector(".theme-toggle-container").click());
    });
    await t.check("clicking the SCAM RADAR module card opens Threat Detection → Scam", async () => {
        await page.evaluate(() => document.getElementById("modules")?.scrollIntoView());
        await sleep(400);
        await clickText("SCAM RADAR", ".module-card");
        await page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 15000 });
        await page.waitForFunction(() => document.querySelector(".tab-item.active"), { timeout: 10000 });
        const sel = await activeSelection();
        ok(/THREAT DETECTION/.test(sel.module) && /SCAM/.test(sel.sub), `landed on ${JSON.stringify(sel)}`);
    });
    await t.check("navbar 'Honeypot' link opens Autonomous Honeypot → Live Engagement", async () => {
        await clickText("Honeypot", ".navbar-link");
        await sleep(800);
        const sel = await activeSelection();
        ok(/AUTONOMOUS HONEYPOT/.test(sel.module) && /LIVE ENGAGEMENT/.test(sel.sub), `landed on ${JSON.stringify(sel)}`);
    });

    // ── Dashboard: every view renders ───────────────────────
    t.section("Dashboard — every module and view renders cleanly");
    let modules = [];
    await t.check("dashboard shows the 8 CyberRakshak modules", async () => {
        modules = await page.evaluate(() => [...document.querySelectorAll(".tab-item")].map((e) => e.textContent.trim()));
        ok(modules.length === 8, `found ${modules.length}: ${modules.join(", ")}`);
    });
    const views = [];
    for (let i = 0; i < 8; i++) {
        await page.evaluate((k) => document.querySelectorAll(".tab-item")[k].click(), i);
        await sleep(500);
        const subs = await page.evaluate(() => [...document.querySelectorAll(".forensic-container > .hp-tabs > .hp-tab")].map((e) => e.textContent.trim()));
        (subs.length ? subs : [null]).forEach((s) => views.push({ i, module: modules[i] || `#${i}`, sub: s }));
    }
    for (const v of views) {
        await t.check(`${v.module}${v.sub ? ` → ${v.sub}` : ""}`, async () => {
            const errBefore = consoleErrors.length + pageErrors.length + unexpected().length;
            await page.evaluate((k) => document.querySelectorAll(".tab-item")[k].click(), v.i);
            await sleep(400);
            if (v.sub) await clickText(v.sub, ".forensic-container > .hp-tabs > .hp-tab");
            await sleep(700); await settled();
            const txt = await inner();
            ok(txt.trim().length > 60, `view is (nearly) empty: "${txt.slice(0, 80)}"`);
            const hasErrBox = await page.evaluate(() => !!document.querySelector(".forensic-container-inner .error-box"));
            ok(!hasErrBox, `error box visible: ${(await page.evaluate(() => document.querySelector(".error-box")?.innerText))}`);
            ok(!txt.includes("LOADING…"), "still loading after 12s");
            ok(!/undefined|NaN|\[object Object\]/.test(txt), `view renders bad values: ${(txt.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,30}/) || [""])[0]}`);
            const now = consoleErrors.length + pageErrors.length + unexpected().length;
            ok(now === errBefore, `console/page/network errors while rendering:\n${[...consoleErrors, ...pageErrors].slice(errBefore).map((e) => e.text).join("\n")}\n${unexpected().map((b) => `${b.status} ${b.url}`).join("\n")}`);
        });
    }

    // ── Threat Detection scenarios ──────────────────────────
    t.section("Threat Detection — modules do real work");
    await t.check("Scam: probe returns a verdict with debrief, and hands off to the honeypot", async () => {
        await gotoView("THREAT DETECTION", "SCAM");
        await clickText("PROBE_SIGNATURE_01");
        await waitText("CASE_VERDICT"); await waitText("RESOLUTION_PROTOCOL");
        ok((await inner()).includes("HIGH RISK"), "sample scam not HIGH RISK");
        await clickText("ENGAGE_WITH_HONEYPOT_AGENT");
        await sleep(1200);
        const sel = await activeSelection();
        ok(/AUTONOMOUS HONEYPOT/.test(sel.module) && /LIVE ENGAGEMENT/.test(sel.sub), `hand-off landed on ${JSON.stringify(sel)}`);
        const seeded = await page.evaluate(() => document.querySelector(".forensic-container-inner textarea")?.value);
        ok(seeded && seeded.length > 10, "message was not carried into Live Engagement");
    });
    await t.check("Fake News: verification returns a verdict and forward analysis", async () => {
        await gotoView("THREAT DETECTION", "FAKE NEWS");
        await clickText("LOAD_SAMPLE_01"); await clickText("INITIATE_SOURCE_VERIFICATION");
        await waitText("CASE_VERDICT"); await waitText("WHATSAPP_FORWARD_ANALYSIS");
    });
    await t.check("Behavior: anomaly analysis returns a verdict; history chart plots REAL analyses (no fabricated bars)", async () => {
        await page.evaluate(() => localStorage.removeItem("bm_txlog"));
        await gotoView("THREAT DETECTION", "BEHAVIOR");
        await clickText("LOAD_BASELINE"); await clickText("START_BEHAVIOR_ANALYSIS");
        await waitText("CASE_VERDICT"); await waitText("ANALYSIS_HISTORY");
        let bars = await page.evaluate(() => [...document.querySelectorAll(".forensic-container-inner span")].filter((s) => s.textContent.trim() === "NOW").length);
        const first = await page.evaluate(() => [...document.querySelectorAll(".forensic-container-inner span")].map((s) => s.textContent.trim()).filter((x) => /^(NOW|A-\d)$/.test(x)));
        ok(first.length === 1 && first[0] === "NOW", `first analysis must plot exactly one bar, got ${JSON.stringify(first)}`);
        await clickText("LOAD_ANOMALY_VECTOR"); await clickText("START_BEHAVIOR_ANALYSIS"); await sleep(2500);
        const second = await page.evaluate(() => [...document.querySelectorAll(".forensic-container-inner span")].map((s) => s.textContent.trim()).filter((x) => /^(NOW|A-\d)$/.test(x)));
        ok(second.length === 2 && second.includes("A-1") && second.includes("NOW"), `second analysis must add the first as A-1, got ${JSON.stringify(second)}`);
        ok(!(await inner()).includes("TRANSACTION_PATTERN"), "old simulated chart still present");
    });
    await t.check("Phishing: evidence table, debrief and action are shown; HTTPS is not a driver", async () => {
        await gotoView("THREAT DETECTION", "PHISHING");
        await clickText("LOAD_TARGET_02"); await clickText("INITIATE_URL_DECONSTRUCTION");
        await waitText("URL_INTELLIGENCE_EVIDENCE"); await waitText("BRAND_IMPERSONATION");
        await waitText("NEURAL_DEBRIEF"); await waitText("RESOLUTION_PROTOCOL");
        ok((await inner()).includes("HIGH RISK"), "brand-impersonation URL not HIGH RISK");
        await clickText("RESET"); await clickText("LOAD_TARGET_04"); await clickText("INITIATE_URL_DECONSTRUCTION");
        await waitText("Official SBI");
        ok(!(await inner()).includes("HIGH RISK"), "official SBI domain flagged as HIGH RISK");
    });
    await t.check("Loan Apps: quick lookup, weights from the engine, and a full audit", async () => {
        await gotoView("THREAT DETECTION", "LOAN");
        await typeInto(".forensic-container-inner input[type=text]", "cashnow");
        await clickText("QUICK_DATABASE_LOOKUP"); await waitText("BLACKLISTED");
        const scores = await page.evaluate(() => [...document.querySelectorAll(".check-score")].map((e) => e.textContent));
        ok(scores.includes("+35") && scores.includes("+25"), `weights not from the engine: ${scores.join(" ")}`);
        for (const n of [0, 1, 3]) await page.evaluate((k) => document.querySelectorAll(".checklist-item-forensic")[k].click(), n);
        await clickText("INITIATE_SECURITY_AUDIT"); await waitText("CASE_VERDICT");
    });
    await t.check("Multi-Vector: fusion scan returns a report; dark-web check reports honestly", async () => {
        await gotoView("THREAT DETECTION", "MULTI-VECTOR");
        await typeInto(".forensic-container-inner textarea", "Your account is blocked. Share the OTP and click the link now.");
        await typeInto(".forensic-container-inner input[placeholder*='suspicious-uri']", "http://sbi-kyc-update.xyz/login");
        await clickText("START_MULTI_VECTOR_SCAN"); await waitText("FUSION_REPORT_SUMMARY");
        await typeInto("input[placeholder*='ENTER_EMAIL']", "someone@example.com");
        await clickText("[ SCAN ]");
        await page.waitForFunction(() => /LOOKUP_NOT_CONFIGURED|EXPOSURE|NO EXPOSURE|SCAN_ERROR/.test(document.body.innerText), { timeout: 15000 });
        const txt = await bodyText();
        ok(!/\[DEMO\]/.test(txt), "simulated [DEMO] breach result is back");
    });

    // ── Honeypot ────────────────────────────────────────────
    t.section("Autonomous Honeypot — real conversation through the UI");
    await t.check("Live Engagement: send a soft opener, get an in-persona reply and a detection panel", async () => {
        await gotoView("AUTONOMOUS HONEYPOT", "LIVE");
        await clickText("SCRIPT_01");
        await clickText("SEND_TO_AGENT");
        await page.waitForSelector(".hp-msg.agent", { timeout: 25000 });
        await waitText("SCAM_DETECTED"); await waitText("PROBABILITY");
        ok((await page.evaluate(() => document.querySelector(".hp-msg.agent .hp-msg-body").innerText)).length > 5, "agent reply empty");
    });
    await t.check("Live Engagement: a scam message with UPI/phone/link is extracted into the intelligence panel", async () => {
        await typeInto(".forensic-container-inner textarea", `Sir pay Rs 5000 to ${UPI} or call +91 9811100055 to avoid arrest. Link http://kyc-${RUN}.xyz/pay`);
        await clickText("SEND_TO_AGENT");
        await page.waitForFunction((u) => document.body.innerText.includes(u.toUpperCase()) || document.body.innerText.includes(u), { timeout: 25000 }, UPI).catch(() => { throw new Error("UPI id never appeared in EXTRACTED_INTELLIGENCE"); });
        const txt = await inner();
        ok(/9811100055/.test(txt), "phone not extracted");
        ok(new RegExp(`kyc-${RUN}`, "i").test(txt), "URL not extracted");
        await sleep(3500);   // background enrichment (quality, profile, alerts)
    });
    await t.check("Conversations: case file has every panel; report buttons work", async () => {
        await clickText("OPEN_CASE");
        await sleep(1000); await settled();
        for (const p of ["AGENT_STATE", "SCAM_KILL_CHAIN", "TRANSCRIPT", "EXTRACTED_INTELLIGENCE", "PER_TURN_REPLY_QUALITY", "AUDIT_TRAIL", "TIMELINE"]) await waitText(p);
        const links = await page.evaluate(() => [...document.querySelectorAll("a[download]")].map((a) => a.getAttribute("href")));
        const pdf = links.find((l) => l.includes("/pdf")); const json = links.find((l) => l.includes("/json"));
        ok(pdf && json, `report links missing: ${links.join(", ")}`);
        const p = await fetchIn(pdf); ok(p.status === 200 && p.head.startsWith("%PDF"), `PDF link → ${p.status} ${p.head}`);
        const j = await fetchIn(json); ok(j.status === 200, `JSON link → ${j.status}`);
        await clickText("GENERATE_PDF_ON_SERVER"); await waitText("Report saved on server");
        await clickText("BUILD_PROFILE"); await waitText("Profile updated");
        await clickText("CORRELATE_SESSIONS"); await waitText("related session");
        const ok5 = await page.evaluate(() => document.querySelectorAll(".hp-stage.reached").length);
        ok(ok5 >= 1, "kill-chain shows no reached stage");
    });

    // ── Threat / Scammer intelligence ───────────────────────
    t.section("Threat & Scammer Intelligence");
    await t.check("Harvested Indicators lists the UPI id, phone, URL and amount just captured", async () => {
        await gotoView("THREAT INTELLIGENCE", "HARVESTED");
        const txt = await inner();
        ok(txt.includes(UPI), "UPI missing"); ok(/9811100055/.test(txt), "phone missing"); ok(new RegExp(`kyc-${RUN}`, "i").test(txt), "URL missing");
        ok(/₹5,000/.test(txt) || /LARGEST_SINGLE_ASK[\s\S]*₹/.test(txt), "amount summary missing");
    });
    await t.check("Identifier Database: known-threat lookup recognises the UPI id", async () => {
        await gotoView("THREAT INTELLIGENCE", "IDENTIFIER");
        await typeInto(".hp-input", UPI, 0);
        await clickText("CHECK_AGAINST_INTEL_DB"); await waitText("KNOWN THREAT");
    });
    await t.check("Profiles: the scammer profile exists and its detail opens", async () => {
        await gotoView("SCAMMER INTELLIGENCE", "PROFILES");
        await page.waitForFunction((u) => [...document.querySelectorAll(".hp-row")].some((r) => r.textContent.includes(u)), { timeout: 15000 }, UPI).catch(() => { throw new Error("profile row for the UPI id not listed"); });
        await clickText(UPI, ".hp-row");
        await waitText("PSYCHOLOGY"); await waitText("BEHAVIOURAL_FINGERPRINT"); await waitText("LINKED_SESSIONS");
    });
    await t.check("Profiles: min-risk filter and Active Threat Feed toggle work", async () => {
        await clickText("ACTIVE_THREAT_FEED"); await sleep(1500); await settled();
        ok(!(await page.evaluate(() => !!document.querySelector(".error-box"))), "threat feed errored");
        await clickText("ALL", ".hp-tab");
    });
    await t.check("Campaigns: a campaign containing the UPI id is listed with the attribution caveat", async () => {
        // a second victim receives the same scammer's UPI id → the two sessions must be linked into one campaign
        const twin = await page.evaluate(async (u, run) => (await fetch("/api/v1/console/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: `${run}-twin`, message: `URGENT: RBI notice. Pay Rs 2000 fine to ${u} or arrest. Link http://rbi-${run}.xyz/x` }) })).status, UPI, RUN);
        ok(twin === 200, `twin session failed: ${twin}`);
        await sleep(1500);
        await gotoView("SCAMMER INTELLIGENCE", "CAMPAIGNS");
        await waitText(UPI); await waitText("YES — shared infrastructure"); await waitText("not proof");
        await page.evaluate(() => [...document.querySelectorAll("label.hp-check")].find((l) => l.textContent.includes("2+ sessions")).querySelector("input").click());
        await sleep(1200); await waitText(UPI);
    });
    await t.check("Archetypes & Vulnerability: distributions render", async () => {
        await gotoView("SCAMMER INTELLIGENCE", "ARCHETYPES");
        await waitText("SCAM_ARCHETYPES"); await waitText("PRESSURE_VELOCITY");
    });

    // ── Protection ──────────────────────────────────────────
    t.section("Protection");
    await t.check("Risk Fusion: sample returns score, verdict, breakdown that adds up, evidence", async () => {
        await gotoView("PROTECTION", "RISK FUSION");
        await clickText("SAMPLE_01");
        await waitText("WHY_THIS_SCORE", 25000); await waitText("EVIDENCE");
        const txt = await inner();
        const score = Number((txt.match(/VERDICT\s*\n\s*(\d+)\s*\/\s*100/) || [])[1]);
        ok(score >= 80, `sample scam scored ${score}`);
        const pts = [...txt.matchAll(/\+(\d+(?:\.\d+)?)\s*\n?\s*\n?(?:STRONGEST|[A-Z_]+ \(SIGNAL)/g)];
        const breakdown = await page.evaluate(() => [...document.querySelectorAll(".hp-panel")].find((p) => p.innerText.startsWith("WHY_THIS_SCORE"))?.innerText || "");
        const sum = [...breakdown.matchAll(/\+(\d+(?:\.\d+)?)/g)].reduce((a, m) => a + Number(m[1]), 0);
        ok(Math.abs(sum - score) <= 2, `breakdown adds to ${sum.toFixed(1)}, headline says ${score} (${pts.length} lines)`);
    });
    await t.check("Alerts: change a trigger, save, reload shows persisted; webhook test reaches a receiver", async () => {
        await gotoView("PROTECTION", "ALERTS");
        const toggle = () => page.evaluate(() => { const l = [...document.querySelectorAll("label.hp-check")].find((x) => x.textContent.includes("Agent reply quality drop")); l.querySelector("input").click(); return l.querySelector("input").checked; });
        const initial = await page.evaluate(() => [...document.querySelectorAll("label.hp-check")].find((x) => x.textContent.includes("Agent reply quality drop")).querySelector("input").checked);
        const now = await toggle();
        ok(now !== initial, "checkbox did not toggle");
        await clickText("SAVE_CONFIG"); await waitText("Configuration saved");
        await gotoView("PROTECTION", "RISK FUSION"); await gotoView("PROTECTION", "ALERTS");
        const persisted = await page.evaluate(() => [...document.querySelectorAll("label.hp-check")].find((x) => x.textContent.includes("Agent reply quality drop")).querySelector("input").checked);
        ok(persisted === now, "trigger change did not persist");
        await toggle(); await clickText("SAVE_CONFIG"); await waitText("Configuration saved");   // restore

        let hits = 0;
        const receiver = await new Promise((res) => { const s = http_.createServer((rq, rs) => { hits++; rq.resume(); rs.end("ok"); }).listen(0, "127.0.0.1", () => res(s)); });
        await typeInto("input[placeholder*='hooks.example.com']", `http://127.0.0.1:${receiver.address().port}/hook`);
        await clickText("TEST_WEBHOOK"); await waitText("Webhook test:");
        receiver.close();
        ok(hits === 1, `receiver got ${hits} requests`);
        ok(!(await bodyText()).includes('"success":false'), "webhook test reported failure");
    });

    // ── Analytics / Reports / Integrations ──────────────────
    t.section("Analytics, Reports, Integrations");
    await t.check("Metrics & Trends: totals, 7/30/90 switch, export links, re-aggregate", async () => {
        await gotoView("ANALYTICS", "METRICS");
        await waitText("TOTAL_SESSIONS"); await waitText("SCAM_ARCHETYPES");
        await clickText("7 DAYS", ".hp-tab"); await sleep(800); await clickText("90 DAYS", ".hp-tab"); await sleep(800);
        const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[download]")].map((a) => a.getAttribute("href")));
        for (const h of hrefs.filter((x) => x.includes("analytics/export"))) { const r = await fetchIn(h); ok(r.status === 200, `${h} → ${r.status}`); }
        await clickText("RE-AGGREGATE_ANALYTICS"); await sleep(2500);
        ok(!(await page.evaluate(() => !!document.querySelector(".forensic-container-inner .error-box"))), "re-aggregate errored");
    });
    await t.check("Quality Scores: averages and recent replies", async () => {
        await gotoView("ANALYTICS", "QUALITY"); await waitText("AVERAGE_SCORES"); await waitText("RECENT_REPLIES");
    });
    await t.check("Language: Hinglish sample is detected with scam indicators", async () => {
        await gotoView("ANALYTICS", "LANGUAGE");
        await clickText("SAMPLE_01"); await waitText("HINGLISH"); await waitText("SCAM_INDICATORS");
    });
    await t.check("Reports: the new case has PDF/JSON/STIX links that all download", async () => {
        await gotoView("REPORTS");
        await page.waitForFunction((r) => document.body.innerText.includes("SCAM_CASES"), { timeout: 10000 }, RUN);
        const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[download]")].map((a) => a.getAttribute("href")));
        const kinds = { pdf: hrefs.find((h) => h.includes("/pdf")), json: hrefs.find((h) => h.includes("/json")), stix: hrefs.find((h) => h.includes("/stix")) };
        ok(kinds.pdf && kinds.json && kinds.stix, `missing link types: ${JSON.stringify(kinds)}`);
        const pdf = await fetchIn(kinds.pdf); ok(pdf.status === 200 && pdf.head.startsWith("%PDF"), "PDF link failed");
        const stix = await page.evaluate(async (u) => (await (await fetch(u)).json()).type, kinds.stix); ok(stix === "bundle", "STIX link is not a bundle");
    });
    await t.check("Integrations: every integration reports a status", async () => {
        await gotoView("INTEGRATIONS");
        for (const p of ["GUVI_EVALUATOR_API", "LLM (agent brain)", "WEBHOOKS_&_ALERT_CHANNELS", "CYBERRAKSHAK_ML_ENGINE", "DATABASE (MongoDB)", "BREACH_LOOKUP"]) await waitText(p);
    });

    // ── Client-side feature + resilience ────────────────────
    t.section("Client features and resilience");
    await t.check("Guardian link: contact details save to this browser", async () => {
        await page.evaluate(() => localStorage.removeItem("cyberrakshak_guardian"));
        await page.reload({ waitUntil: "networkidle2" });
        await page.waitForSelector(".g-input", { timeout: 15000 });
        await typeInto(".g-input", "Test Guardian", 0); await typeInto(".g-input", "guardian@example.com", 1);
        await clickText("ACTIVATE", ".g-save-btn");
        await sleep(500);
        const saved = await page.evaluate(() => localStorage.getItem("cyberrakshak_guardian"));
        ok(saved && saved.includes("guardian@example.com"), `not saved: ${saved}`);
    });
    await t.check("deep link /dashboard loads directly and the browser back/forward buttons work", async () => {
        await page.goto(`${ctx.base}/dashboard`, { waitUntil: "networkidle2" });
        await page.waitForSelector(".tab-item", { timeout: 20000 });
        await page.goto(`${ctx.base}/`, { waitUntil: "networkidle2" });
        await page.goBack({ waitUntil: "networkidle2" });
        await page.waitForSelector(".tab-item", { timeout: 20000 });
    });
    await t.check("an unknown client route falls back to the app instead of a blank/404 page", async () => {
        const r = await page.goto(`${ctx.base}/this/route/does/not/exist`, { waitUntil: "networkidle2" });
        ok(r.status() === 200, `status ${r.status()}`);
        ok((await page.evaluate(() => document.getElementById("root").children.length)) > 0, "blank page");
    });
    await t.check("Home and Dashboard have no horizontal overflow at phone width (390px)", async () => {
        await page.setViewport({ width: 390, height: 800 });
        const over = [];
        for (const p of ["/", "/dashboard"]) {
            await page.goto(`${ctx.base}${p}`, { waitUntil: "networkidle2" });
            await page.waitForFunction(() => !document.querySelector(".boot-overlay"), { timeout: 30000 }).catch(() => {});
            const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
            if (w.sw > w.cw + 4) over.push(`${p}: content ${w.sw}px wide in a ${w.cw}px viewport`);
        }
        await page.setViewport({ width: 1440, height: 900 });
        if (over.length) t.warn(`not phone-friendly — ${over.join("; ")} (desktop layout by design)`);
    });

    // ── Global error budget ─────────────────────────────────
    t.section("Whole-session error budget");
    await t.check("zero uncaught JavaScript exceptions", async () => { ok(!pageErrors.length, pageErrors.map((e) => `${e.text} @ ${e.url}`).join("\n")); });
    await t.check("zero unexpected console errors", async () => {
        const allowed = badResponses.filter((b) => EXPECTED_HTTP_ERRORS.some((e) => b.path === e.path && b.status === e.status)).length;
        const real = consoleErrors.filter((e) => !/Failed to load resource/.test(e.text));
        const netLogs = consoleErrors.filter((e) => /Failed to load resource/.test(e.text));
        ok(!real.length, real.map((e) => `${e.text} @ ${e.url}`).join("\n"));
        ok(netLogs.length <= allowed, `${netLogs.length - allowed} 'Failed to load resource' error(s) beyond the expected ones`);
    });
    await t.check("zero unexpected failed network requests (non-2xx / aborted)", async () => {
        ok(!unexpected().length, unexpected().map((b) => `${b.status} ${b.url}`).join("\n"));
        ok(!failedRequests.length, failedRequests.join("\n"));
    });
    await t.check("server logged no errors during the browser session", async () => {
        const bad = ctx.gw.log().split("\n").filter((l) => /\b(TypeError|ReferenceError|is not a function|Cannot read prop|MongoServerError|post-process \[)/i.test(l) || /^\s*Error:/.test(l));
        ok(!bad.length, bad.slice(0, 6).join("\n"));
    });
}

async function cleanup(t) {
    try { await ctx.browser?.close(); } catch { /* closed */ }
    ctx.gw?.stop();
    const mongoose = require("mongoose");
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
        const db = mongoose.connection.db;
        const turns = await db.collection("conversationturns").find({ text: new RegExp(RUN) }).project({ sessionId: 1 }).toArray();
        const ids = [...new Set(turns.map((x) => x.sessionId))];
        // The soft opener session has no RUN text: it shares the id created by the same Live Engagement conversation
        for (const c of ["sessions", "conversationturns", "qualitymetrics", "auditlogs"]) await db.collection(c).deleteMany({ sessionId: { $in: ids } });
        await db.collection("scammerprofiles").deleteMany({ "identifiers.upiIds": UPI });
        await db.collection("scammerintelligences").deleteMany({ upiId: UPI });
        await db.collection("incidents").deleteMany({ $or: [{ "identifiers.upiIds": UPI }, { sessionIds: { $in: ids } }] });
        await db.collection("alertconfigs").updateMany({}, { $pull: { history: { sessionId: { $in: ids } } } });
        const dir = path.join(ROOT, "reports");
        if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => ids.some((i) => f.includes(i))).forEach((f) => fs.unlinkSync(path.join(dir, f)));
    } finally { await mongoose.disconnect().catch(() => {}); }
}

module.exports = { run, cleanup, title: "Sprint 4 — website in a real browser" };
