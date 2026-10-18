// src/services/mlProcessManager.js
// Supervises the Python ML engine (ml/app.py) as a child of the Node gateway, so the
// whole platform starts with a single `npm start` — no second terminal, no second port
// exposed to the outside. If an ML engine is already reachable at ML_URL (someone ran
// it by hand, or it's hosted elsewhere), that one is used instead of spawning another.

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ML_DIR = path.join(__dirname, "..", "..", "ml");
const ML_PORT = parseInt(process.env.ML_PORT || "5050", 10);
const ML_URL = process.env.CYBERRAKSHAK_URL || `http://127.0.0.1:${ML_PORT}`;
const MAX_RESTARTS = 5;

let child = null;
let stopping = false;
let restarts = 0;
let managed = false;
let lastError = null;
let startedAt = null;

async function isReachable(timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${ML_URL}/api/health`, { signal: controller.signal });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

function findPython() {
    const candidates = [process.env.PYTHON_BIN, "python", "python3", "py"].filter(Boolean);
    for (const bin of candidates) {
        const probe = spawnSync(bin, ["--version"], { encoding: "utf8" });
        if (!probe.error && probe.status === 0) return bin;
    }
    return null;
}

function launch(pythonBin) {
    child = spawn(pythonBin, ["app.py"], {
        cwd: ML_DIR,
        env: {
            ...process.env,
            PORT: String(ML_PORT),   // ml/.env also defines PORT; an explicit env var wins over dotenv
            ML_HOST: "127.0.0.1",    // internal only — the browser reaches it through /api/v1/ml/*
            DEBUG: "False",
            PYTHONUNBUFFERED: "1",
            PYTHONIOENCODING: "utf-8",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    });
    startedAt = Date.now();

    const forward = (stream, tag) => {
        stream.on("data", (buf) => {
            const text = buf.toString().trimEnd();
            // Flask logs every request to stderr; keep only meaningful lines
            if (!text || /GET \/api\/health|\bHTTP\/1\.1" 200/.test(text)) return;
            console.log(`[ml${tag}] ${text.split("\n").join("\n[ml] ")}`);
        });
    };
    forward(child.stdout, "");
    forward(child.stderr, "!");

    child.on("exit", (code, signal) => {
        child = null;
        if (stopping) return;
        lastError = `ML engine exited (code=${code}, signal=${signal})`;
        console.error(`⚠️  ${lastError}`);
        if (restarts < MAX_RESTARTS) {
            restarts += 1;
            const delay = Math.min(1000 * 2 ** restarts, 15000);
            console.log(`🔁 Restarting ML engine in ${delay}ms (attempt ${restarts}/${MAX_RESTARTS})`);
            setTimeout(() => !stopping && launch(pythonBin), delay);
        } else {
            console.error("❌ ML engine kept crashing — giving up. /api/v1/ml/* will return 503.");
        }
    });
}

async function start() {
    if (process.env.ML_AUTO_START === "false") {
        console.log(`ℹ️  ML_AUTO_START=false — expecting an external ML engine at ${ML_URL}`);
        return;
    }
    if (await isReachable(800)) {
        console.log(`🔗 ML engine already running at ${ML_URL} — using it (not spawning another)`);
        return;
    }
    if (!fs.existsSync(path.join(ML_DIR, "app.py"))) {
        lastError = `ml/app.py not found at ${ML_DIR}`;
        console.error(`❌ ${lastError}`);
        return;
    }
    const pythonBin = findPython();
    if (!pythonBin) {
        lastError = "Python not found — install Python 3.10+ (or set PYTHON_BIN) and run: pip install -r requirements.txt";
        console.error(`❌ ${lastError}`);
        return;
    }
    managed = true;
    console.log(`🧠 Starting ML engine (${pythonBin} ml/app.py) on 127.0.0.1:${ML_PORT}`);
    launch(pythonBin);

    // Wait (non-blocking for the HTTP server) until it answers, so the log says when it's ready
    for (let i = 0; i < 40; i++) {
        if (await isReachable(1000)) {
            console.log(`✅ ML engine ready (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
            return;
        }
        if (!child && restarts >= MAX_RESTARTS) return;
        await new Promise((r) => setTimeout(r, 750));
    }
    lastError = "ML engine did not become healthy within 30s";
    console.error(`⚠️  ${lastError}`);
}

function stop() {
    stopping = true;
    if (child) {
        try { child.kill(); } catch { /* already gone */ }
        child = null;
    }
}

async function status() {
    const reachable = await isReachable(1200);
    let health = null;
    if (reachable) {
        try {
            health = await (await fetch(`${ML_URL}/api/health`)).json();
        } catch { /* leave null */ }
    }
    return {
        reachable,
        managed,
        pid: child?.pid ?? null,
        restarts,
        url: ML_URL,
        uptimeSec: startedAt && child ? Math.round((Date.now() - startedAt) / 1000) : null,
        lastError: reachable ? null : lastError,
        health,
    };
}

module.exports = { start, stop, status, isReachable, ML_URL };
