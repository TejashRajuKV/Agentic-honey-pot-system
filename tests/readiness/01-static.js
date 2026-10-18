// Sprint 1 — static integrity: nothing is broken before a single request is made.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { ROOT, ok, walk } = require("./harness");

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const BUILTINS = new Set(require("module").builtinModules);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const feDir = path.join(ROOT, "frontend");
const fePkg = JSON.parse(fs.readFileSync(path.join(feDir, "package.json"), "utf8"));

const backendFiles = () =>
    ["src", "agent", "detection", "shared-contracts", "scripts", "tests/readiness"]
        .flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d), (p) => p.endsWith(".js")) : []));

function requiresOf(source) {
    const out = [];
    const re = /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
    let m;
    while ((m = re.exec(source)) !== null) out.push(m[1]);
    return out;
}

function resolvesFile(fromFile, spec) {
    const base = path.resolve(path.dirname(fromFile), spec);
    return [base, `${base}.js`, `${base}.json`, path.join(base, "index.js")].some((p) => fs.existsSync(p) && fs.statSync(p).isFile());
}

async function run(t) {
    t.section("Backend (Node)");

    await t.check("every backend .js file parses (node --check)", async () => {
        const bad = [];
        for (const f of backendFiles()) {
            const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
            if (r.status !== 0) bad.push(`${rel(f)}: ${r.stderr.split("\n").find((l) => l.includes("Error")) || r.stderr.slice(0, 120)}`);
        }
        ok(!bad.length, bad.join("\n"));
    });

    await t.check("every relative require() points at a file that exists", async () => {
        const bad = [];
        for (const f of backendFiles()) {
            if (rel(f).startsWith("tests/readiness/")) continue;   // the suite itself quotes require() strings
            for (const spec of requiresOf(fs.readFileSync(f, "utf8"))) {
                if (spec.startsWith(".") && !resolvesFile(f, spec)) bad.push(`${rel(f)} → ${spec}`);
            }
        }
        ok(!bad.length, bad.join("\n"));
    });

    await t.check("every package require()d is declared in package.json and installed", async () => {
        const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
        const bad = [];
        for (const f of backendFiles()) {
            for (const spec of requiresOf(fs.readFileSync(f, "utf8"))) {
                if (spec.startsWith(".") || spec.startsWith("node:")) continue;
                const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
                if (BUILTINS.has(name)) continue;
                if (!declared.has(name)) bad.push(`${rel(f)} requires '${name}' which is not in package.json`);
                else if (!fs.existsSync(path.join(ROOT, "node_modules", name))) bad.push(`'${name}' declared but not installed`);
            }
        }
        ok(!bad.length, [...new Set(bad)].join("\n"));
    });

    await t.check("every module loads without throwing (routes, services, models, controllers)", async () => {
        const files = ["src/routes", "src/services", "src/models", "src/controllers", "src/middleware", "agent", "detection"]
            .flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? walk(path.join(ROOT, d), (p) => p.endsWith(".js")) : []));
        const script = `const files=${JSON.stringify(files)};for(const f of files){try{require(f)}catch(e){console.log('FAIL '+require('path').relative(${JSON.stringify(ROOT)},f)+': '+e.message.split(String.fromCharCode(10))[0])}}process.exit(0)`;
        const r = spawnSync(process.execPath, ["-e", script], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
        const fails = r.stdout.split("\n").filter((l) => l.startsWith("FAIL "));
        ok(!fails.length, fails.join("\n"));
    });

    await t.check("the HTTP app object builds (src/app.js) with no side-effect crash", async () => {
        const r = spawnSync(process.execPath, ["-e", "const a=require('./src/app');if(typeof a.use!=='function')throw new Error('not an express app');process.exit(0)"], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
        ok(r.status === 0, (r.stderr || r.stdout).split("\n").slice(0, 4).join("\n"));
    });

    await t.check("environment variables used in code are documented in .env.example", async () => {
        const used = new Set();
        for (const f of backendFiles()) {
            if (rel(f).startsWith("tests/readiness/")) continue;   // test-only variables (CHROME_PATH, BASE_URL) are documented in the README
            const m = fs.readFileSync(f, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g);
            for (const x of m) used.add(x[1]);
        }
        const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
        const internal = new Set(["NODE_ENV", "BASE_URL", "RISK_WEIGHTS", "PYTHON_BIN"]);
        const missing = [...used].filter((v) => !internal.has(v) && !new RegExp(`^#?\\s*${v}=`, "m").test(example));
        ok(!missing.length, `undocumented in .env.example: ${missing.join(", ")}`);
    });

    await t.check("no leftover references to removed pieces (Telegram bot, old ports/paths)", async () => {
        const bad = [];
        const scan = [...backendFiles().filter((f) => !f.includes("tests/readiness") && !f.includes("tests\\readiness")), ...walk(path.join(feDir, "src"), (p) => /\.(jsx?|css)$/.test(p))];
        for (const f of scan) {
            const s = fs.readFileSync(f, "utf8");
            if (/node-telegram-bot-api|telegramBot/i.test(s)) bad.push(`${rel(f)}: telegram bot reference`);
            if (/ai in cybersecurity/i.test(s)) bad.push(`${rel(f)}: old project path`);
            if (/localhost:5050|localhost:5174|VITE_API_URL/.test(s) && !f.includes("mlProcessManager")) bad.push(`${rel(f)}: hardcoded old endpoint`);
        }
        ok(!bad.length, bad.join("\n"));
    });

    t.section("ML engine (Python)");

    await t.check("every Python file compiles", async () => {
        const files = walk(path.join(ROOT, "ml"), (p) => p.endsWith(".py"));
        ok(files.length > 0, "no python files found");
        const r = spawnSync("python", ["-m", "py_compile", ...files], { encoding: "utf8", timeout: 60000 });
        ok(r.status === 0, (r.stderr || r.stdout).split("\n").slice(0, 6).join("\n"));
    });

    await t.check("every package in requirements.txt is importable", async () => {
        const reqs = fs.readFileSync(path.join(ROOT, "requirements.txt"), "utf8").split("\n")
            .map((l) => l.trim().split(/[=<>~! ]/)[0].toLowerCase()).filter((l) => l && !l.startsWith("#"));
        const importName = { "scikit-learn": "sklearn", "flask-cors": "flask_cors", "python-dotenv": "dotenv", "gunicorn": null };
        const mods = reqs.map((r) => (r in importName ? importName[r] : r.replace(/-/g, "_"))).filter(Boolean);
        const r = spawnSync("python", ["-c", `import importlib\nbad=[]\nfor m in ${JSON.stringify(mods)}:\n    try: importlib.import_module(m)\n    except Exception as e: bad.append(m+': '+str(e)[:80])\nprint('\\n'.join(bad))`], { encoding: "utf8", timeout: 60000 });
        ok(!r.stdout.trim(), r.stdout.trim());
    });

    await t.check("all trained model files exist and are non-empty", async () => {
        const dir = path.join(ROOT, "ml", "models");
        const pkls = fs.readdirSync(dir).filter((f) => f.endsWith(".pkl"));
        ok(pkls.length >= 4, `expected >= 4 model files, found ${pkls.length}`);
        const empty = pkls.filter((f) => fs.statSync(path.join(dir, f)).size < 1024);
        ok(!empty.length, `suspiciously small model files: ${empty.join(", ")}`);
    });

    t.section("Frontend (React + Vite)");

    await t.check("every relative import in frontend/src resolves to a real file", async () => {
        const exts = ["", ".js", ".jsx", ".json", ".css", "/index.js", "/index.jsx"];
        const bad = [];
        for (const f of walk(path.join(feDir, "src"), (p) => /\.(jsx?|css)$/.test(p))) {
            const s = fs.readFileSync(f, "utf8");
            for (const m of s.matchAll(/(?:import|export)\s[^'"]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
                const spec = m[1] || m[2] || m[3];
                if (!spec || !spec.startsWith(".")) continue;
                const base = path.resolve(path.dirname(f), spec);
                if (!exts.some((e) => fs.existsSync(base + e) && fs.statSync(base + e).isFile())) bad.push(`${rel(f)} → ${spec}`);
            }
        }
        ok(!bad.length, bad.join("\n"));
    });

    await t.check("every npm package imported by the frontend is declared and installed", async () => {
        const declared = new Set([...Object.keys(fePkg.dependencies || {}), ...Object.keys(fePkg.devDependencies || {})]);
        const bad = [];
        for (const f of walk(path.join(feDir, "src"), (p) => /\.jsx?$/.test(p))) {
            for (const m of fs.readFileSync(f, "utf8").matchAll(/from\s+["']([^./][^"']*)["']|import\s+["']([^./][^"']*)["']/g)) {
                const spec = m[1] || m[2];
                const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
                if (!declared.has(name)) bad.push(`${rel(f)} imports '${name}' (not in frontend/package.json)`);
                else if (!fs.existsSync(path.join(feDir, "node_modules", name))) bad.push(`'${name}' declared but not installed`);
            }
        }
        ok(!bad.length, [...new Set(bad)].join("\n"));
    });

    await t.check("production build succeeds with zero errors and zero warnings", async () => {
        const npm = process.platform === "win32" ? "npm.cmd" : "npm";
        const r = spawnSync(npm, ["run", "build"], { cwd: feDir, encoding: "utf8", timeout: 180000, shell: process.platform === "win32", env: { ...process.env, NODE_ENV: "production" } });
        const out = `${r.stdout}\n${r.stderr}`;
        ok(r.status === 0, `build failed:\n${out.split("\n").slice(-12).join("\n")}`);
        const warnings = out.split("\n").filter((l) => /warn|deprecat|error/i.test(l) && !/vite v|built in/i.test(l));
        ok(!warnings.length, `build warnings:\n${warnings.join("\n")}`);
    });

    await t.check("dist/ contains index.html and hashed JS/CSS bundles referenced by it", async () => {
        const dist = path.join(feDir, "dist");
        const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
        const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
        ok(refs.some((r) => r.endsWith(".js")) && refs.some((r) => r.endsWith(".css")), "index.html does not reference JS + CSS bundles");
        const missing = refs.filter((r) => !fs.existsSync(path.join(dist, r)));
        ok(!missing.length, `referenced but missing: ${missing.join(", ")}`);
    });

    await t.check("public assets referenced by the UI exist (images/video under frontend/public)", async () => {
        const pub = path.join(feDir, "public");
        const bad = [];
        for (const f of walk(path.join(feDir, "src"), (p) => /\.(jsx?|css)$/.test(p))) {
            for (const m of fs.readFileSync(f, "utf8").matchAll(/["'(]\/((?:cyber|images|assets|videos?|media)\/[^"')?#\s]+\.(?:png|jpe?g|webp|svg|mp4|webm|gif))/g)) {
                if (!fs.existsSync(path.join(pub, m[1]))) bad.push(`${rel(f)} → /${m[1]}`);
            }
        }
        ok(!bad.length, [...new Set(bad)].join("\n"));
    });
}

module.exports = { run, title: "Sprint 1 — static integrity" };
