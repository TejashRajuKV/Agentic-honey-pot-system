#!/usr/bin/env node
// scripts/dev.js — one command for development: `npm run dev`
//   • Node gateway (auto-restarts the ML engine child process too) on :3000
//   • Vite dev server (hot reload) on :5173, proxying /api → :3000
// Ctrl+C stops everything.

const { spawn } = require("child_process");
const path = require("path");

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const procs = [];

function run(name, cmd, args, cwd) {
    const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: isWin });
    p.on("exit", (code) => {
        if (!shuttingDown) {
            console.log(`\n[dev] ${name} exited (code ${code}) — shutting down`);
            shutdown(code || 0);
        }
    });
    procs.push(p);
}

let shuttingDown = false;
function shutdown(code = 0) {
    shuttingDown = true;
    procs.forEach((p) => { try { p.kill(); } catch { /* gone */ } });
    setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const root = path.join(__dirname, "..");
run("server", process.execPath, ["src/server.js"], root);
run("web", npm, ["run", "dev"], path.join(root, "frontend"));
