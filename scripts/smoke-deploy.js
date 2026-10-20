#!/usr/bin/env node
"use strict";

const DEFAULT_TIMEOUT_MS = 5000;

function parseBaseUrl(raw) {
    if (!raw) throw new Error("Usage: npm run smoke:deploy -- https://your-deployed-host");
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("Deployment URL must be a valid absolute URL");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Deployment URL must use HTTP(S) and must not contain embedded credentials");
    }
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
        throw new Error("Deployment smoke checks require HTTPS except for localhost");
    }
    if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error("Pass only the deployment origin, without a path, query, or fragment");
    }
    return url.origin;
}

async function request(fetchImpl, base, pathname, options = {}) {
    const response = await fetchImpl(`${base}${pathname}`, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* HTML or plain text */ }
    return { status: response.status, json, text, contentType: response.headers.get("content-type") || "" };
}

async function runSmoke(base, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const checks = [];
    const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });

    const probe = await request(fetchImpl, base, "/api/v1/health", { headers: { Accept: "application/json" } });
    check("API health endpoint", probe.status === 200 && probe.json?.status === "ok" && probe.json?.service === "agentic-honeypot",
        `HTTP ${probe.status}; service=${probe.json?.service || "unknown"}`);
    check("MongoDB connectivity", probe.status === 200 && probe.json?.db === "connected",
        `db=${probe.json?.db || "unknown"}`);

    const root = await request(fetchImpl, base, "/", { headers: { Accept: "application/json" } });
    check("Root health endpoint", root.status === 200 && root.json?.status === "ok",
        `HTTP ${root.status}; JSON health response expected`);

    const consolePage = await request(fetchImpl, base, "/", { headers: { Accept: "text/html" } });
    check("Web console is served", consolePage.status === 200
        && consolePage.contentType.toLowerCase().includes("text/html")
        && /<div[^>]+id=["']root["']/.test(consolePage.text),
    `HTTP ${consolePage.status}; content-type=${consolePage.contentType || "missing"}; React root expected`);

    const messages = await request(fetchImpl, base, "/api/v1/messages", { headers: { Accept: "application/json" } });
    check("Message API discovery", messages.status === 200 && messages.json?.status === "success",
        `HTTP ${messages.status}`);

    const protectedPost = await request(fetchImpl, base, "/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({}),
    });
    check("Message API rejects missing credentials", protectedPost.status === 401,
        `HTTP ${protectedPost.status}; expected 401 without x-api-key`);

    const ping = await request(fetchImpl, base, "/ping", { headers: { Accept: "application/json" } });
    check("Liveness ping", ping.status === 200 && ping.json?.status === "ok",
        `HTTP ${ping.status}`);

    return { passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length, checks };
}

async function main() {
    let base;
    try {
        base = parseBaseUrl(process.argv[2] || process.env.DEPLOY_URL);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 2;
        return;
    }
    console.log(`Smoke-testing deployment: ${new URL(base).origin}`);
    try {
        const result = await runSmoke(base);
        for (const item of result.checks) {
            console.log(`${item.passed ? "PASS" : "FAIL"}  ${item.name} — ${item.detail}`);
        }
        console.log(`Deployment smoke test: ${result.passed} passed, ${result.failed} failed`);
        if (result.failed) process.exitCode = 1;
    } catch (error) {
        console.error(`Smoke test could not complete: ${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = { parseBaseUrl, runSmoke };
