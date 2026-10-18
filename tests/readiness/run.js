#!/usr/bin/env node
// tests/readiness/run.js — full-website readiness suite, run one sprint at a time or all of them.
//
//   node tests/readiness/run.js            all sprints
//   node tests/readiness/run.js 1          only sprint 1
//   node tests/readiness/run.js 2 3        sprints 2 and 3
//
// Sprint 1 needs no running server. Sprints 2+ expect `npm start` to be running (BASE_URL to override).

const fs = require("fs");
const path = require("path");
const { T } = require("./harness");

const files = fs.readdirSync(__dirname).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
const wanted = process.argv.slice(2).map((n) => String(n).padStart(2, "0"));

(async () => {
    const results = [];
    for (const f of files) {
        const num = f.slice(0, 2);
        if (wanted.length && !wanted.includes(num)) continue;
        const sprint = require(path.join(__dirname, f));
        console.log(`\n══════ ${sprint.title} ══════`);
        const t = new T(sprint.title);
        try {
            await sprint.run(t);
        } catch (err) {
            t.failed.push({ name: "sprint crashed", message: err.stack || err.message });
            console.log(`  ✗ sprint crashed: ${err.message}`);
        }
        if (typeof sprint.cleanup === "function") await sprint.cleanup(t).catch((e) => console.log(`  (cleanup error: ${e.message})`));
        results.push(t);
        console.log(`\n  → ${t.passed} passed, ${t.failed.length} failed, ${t.warnings.length} warning(s)`);
    }

    const passed = results.reduce((n, r) => n + r.passed, 0);
    const failed = results.flatMap((r) => r.failed.map((f) => `[${r.sprint}] ${f.name}`));
    console.log(`\n══════ TOTAL: ${passed} passed, ${failed.length} failed ══════`);
    if (failed.length) console.log(failed.map((f) => ` - ${f}`).join("\n"));
    process.exit(failed.length ? 1 : 0);
})();
