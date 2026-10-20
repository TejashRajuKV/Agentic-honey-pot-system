#!/usr/bin/env node
"use strict";

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const production = process.argv.includes("--production");
const errors = [];
const warnings = [];
const root = path.resolve(__dirname, "..");

function required(name, options = {}) {
    const value = process.env[name];
    if (typeof value !== "string" || !value.trim()) {
        errors.push(`${name} is required`);
        return "";
    }
    if (options.minLength && value.length < options.minLength) {
        errors.push(`${name} must be at least ${options.minLength} characters long`);
    }
    if (options.reject && options.reject.some((item) => value.trim().toLowerCase() === item)) {
        errors.push(`${name} still contains a placeholder value`);
    }
    return value;
}

if (Number(process.versions.node.split(".")[0]) < 18) {
    errors.push("Node.js 18 or newer is required");
}

if (!fs.existsSync(path.join(root, "frontend", "dist", "index.html"))) {
    errors.push("frontend/dist/index.html is missing; run npm run build first");
}

if (production) {
    const mongoUri = required("MONGODB_URI");
    if (mongoUri && !/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
        errors.push("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme");
    }

    required("API_KEY", {
        minLength: 32,
        reject: ["change-me", "your_secure_api_key_here", "changeme"]
    });
    required("CONSOLE_PASSWORD", { minLength: 12 });
    required("CONSOLE_SESSION_SECRET", { minLength: 32 });

    const callback = (process.env.EVALUATION_CALLBACK_URL || "").trim();
    if (callback) {
        try {
            const url = new URL(callback);
            if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
                errors.push("EVALUATION_CALLBACK_URL must be a public HTTPS URL without embedded credentials");
            }
        } catch {
            errors.push("EVALUATION_CALLBACK_URL must be a valid HTTPS URL");
        }
    }

    if ((process.env.ML_AUTO_START || "true").toLowerCase() !== "false") {
        const candidates = [process.env.PYTHON_BIN, "python", "python3", "py"].filter(Boolean);
        let pythonReady = false;
        for (const bin of candidates) {
            const probe = spawnSync(bin, [
                "-c",
                "import flask, flask_cors, dotenv; print('python-ml-dependencies-ok')"
            ], { encoding: "utf8", timeout: 10000 });
            if (!probe.error && probe.status === 0) {
                pythonReady = true;
                break;
            }
        }
        if (!pythonReady) {
            errors.push("Python ML runtime is unavailable or missing Flask dependencies; install requirements.txt or set ML_AUTO_START=false and configure CYBERRAKSHAK_URL");
        }
    } else if (!process.env.CYBERRAKSHAK_URL) {
        warnings.push("ML_AUTO_START=false but CYBERRAKSHAK_URL is not set");
    }
} else {
    warnings.push("Production secret checks skipped; run npm run release:check before deployment");
}

if (warnings.length) {
    for (const warning of warnings) console.warn(`WARN: ${warning}`);
}
if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    console.error(`Release preflight failed with ${errors.length} issue(s).`);
    process.exitCode = 1;
} else {
    console.log(production
        ? "Release preflight passed: frontend build and required production configuration are present."
        : "Local preflight passed. Production checks were not requested.");
}
