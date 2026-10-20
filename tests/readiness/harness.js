// tests/readiness/harness.js — tiny shared test harness for the readiness suite.
// Each sprint file exports `async function run(t)` and uses t.check(name, fn) / t.warn(msg).

const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "..");
require("dotenv").config({ path: path.join(ROOT, ".env"), quiet: true });

const BASE = process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
const V1 = `${BASE}/api/v1`;

class T {
    constructor(sprint) {
        this.sprint = sprint;
        this.passed = 0;
        this.failed = [];
        this.warnings = [];
        this.runId = `rdy-${Date.now().toString(36)}`;
    }

    async check(name, fn) {
        try {
            await fn();
            this.passed += 1;
            console.log(`  ✓ ${name}`);
        } catch (err) {
            this.failed.push({ name, message: err.message });
            console.log(`  ✗ ${name}\n      ${String(err.message).split("\n").join("\n      ")}`);
        }
    }

    warn(msg) {
        this.warnings.push(msg);
        console.log(`  ⚠ ${msg}`);
    }

    section(title) { console.log(`\n${title}`); }
}

const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, url, body, headers = {}) {
    const full = url.startsWith("http") ? url : `${V1}${url}`;
    const res = await fetch(full, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    const type = res.headers.get("content-type") || "";
    let data;
    if (type.includes("json") || type.includes("stix")) data = await res.json().catch(() => null);
    else data = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type, data, headers: res.headers };
}
const get = (u, h) => http("GET", u, undefined, h);
const post = (u, b, h) => http("POST", u, b ?? {}, h);
const put = (u, b, h) => http("PUT", u, b ?? {}, h);

/** Recursively list files under dir matching a predicate, skipping heavy/irrelevant folders. */
function walk(dir, pred, out = []) {
    const skip = new Set(["node_modules", "dist", ".git", "venv", "__pycache__", "reports", "docs", "cyber", "public"]);
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, pred, out);
        else if (pred(p)) out.push(p);
    }
    return out;
}

/** Discover every route the gateway registers by reading src/app.js and the route files it mounts. */
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

/**
 * A local HTTP sink that records every request. Test gateways point EVALUATION_CALLBACK_URL at it, so a
 * finished honeypot session can never POST test data to the real GUVI evaluation endpoint.
 */
async function startSink() {
    const httpMod = require("http");
    const received = [];
    const server = httpMod.createServer((req, res) => {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => { received.push({ method: req.method, url: req.url, headers: req.headers, body }); res.setHeader("Content-Type", "application/json"); res.end('{"status":"ok"}'); });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    return { url: `http://127.0.0.1:${server.address().port}/callback`, received, close: () => server.close() };
}

/** Start a private gateway on `port`, resolve when Mongo is connected and the ML engine answers. */
async function startGateway(port, extraEnv = {}, opts = {}) {
    const { spawn } = require("child_process");
    let log = "";
    let lastHealth = { api: null, db: null, ml: null };
    const sink = extraEnv.EVALUATION_CALLBACK_URL ? null : await startSink();
    const child = spawn(process.execPath, ["src/server.js"], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port), ...(sink ? { EVALUATION_CALLBACK_URL: sink.url } : {}), ...extraEnv },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    child.stdout.on("data", (b) => { log += b.toString(); });
    child.stderr.on("data", (b) => { log += b.toString(); });
    const base = `http://127.0.0.1:${port}`;
    const mlBase = process.env.CYBERRAKSHAK_URL || `http://127.0.0.1:${process.env.ML_PORT || 5050}`;
    const start = Date.now();
    while (Date.now() - start < 60000) {
        try {
            const apiResponse = await fetch(`${base}/api/v1/health`, { signal: AbortSignal.timeout(1500) });
            lastHealth.api = apiResponse.status;
            if (apiResponse.ok) {
                const apiHealth = await apiResponse.json().catch(() => ({}));
                lastHealth.db = apiHealth.db || "unknown";
                const dbReady = opts.waitDb === false || apiHealth.db === "connected";

                let mlReady = opts.waitMl === false;
                if (!mlReady) {
                    const mlResponse = await fetch(`${mlBase}/api/health`, { signal: AbortSignal.timeout(1500) });
                    lastHealth.ml = mlResponse.status;
                    mlReady = mlResponse.ok;
                } else {
                    const ping = await fetch(`${base}/ping`, { signal: AbortSignal.timeout(1500) });
                    mlReady = ping.ok;
                }

                if (dbReady && mlReady) break;
            }
        } catch {
            // Keep probing while the gateway, MongoDB, and ML engine start.
        }
        if (child.exitCode !== null) {
            if (sink) sink.close();
            throw new Error(`gateway exited early (code=${child.exitCode}); last health=${JSON.stringify(lastHealth)}:
${log.slice(-1200)}`);
        }
        await sleep(500);
    }
    if (Date.now() - start >= 60000) {
        child.kill();
        if (sink) sink.close();
        throw new Error(`gateway not ready after 60s; last health=${JSON.stringify(lastHealth)}:
${log.slice(-1200)}`);
    }
    return {
        base,
        log: () => log,
        callbacks: sink ? sink.received : [],
        stop: () => { try { child.kill(); } catch { /* gone */ } if (sink) sink.close(); }
    };
}

/** Does `obj` contain the dotted path? `[]` means "each element of an array" (first element is checked). */
function hasPath(obj, dotted) {
    let cur = [obj];
    for (const part of dotted.split(".")) {
        const isArr = part.endsWith("[]");
        const key = isArr ? part.slice(0, -2) : part;
        const next = [];
        for (const c of cur) {
            if (c === null || c === undefined) return { ok: false, why: `parent of '${part}' is ${c}` };
            const v = key ? c[key] : c;
            if (v === undefined) return { ok: false, why: `'${part}' is missing` };
            if (isArr) {
                if (!Array.isArray(v)) return { ok: false, why: `'${part}' should be an array` };
                if (v.length) next.push(v[0]);
                else return { ok: true, empty: true };
            } else next.push(v);
        }
        cur = next;
    }
    return { ok: true };
}

module.exports = { T, ROOT, BASE, V1, ok, sleep, http, get, post, put, walk, discoverRoutes, startGateway, startSink, hasPath };
