# CyberRakshak — Agentic Honeypot & AI Cybersecurity Platform

CyberRakshak is an integrated cybersecurity project that combines an agentic honeypot, threat-intelligence correlation, machine-learning analysis, and a React analyst console behind a Node.js/Express gateway.

> **Status and security note:** This repository is an active development project. Features, models, and test coverage may vary by environment. Several console and intelligence API routes are currently unauthenticated; do not deploy the service directly to the public internet without adding and verifying authentication, authorization, and webhook destination controls.

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Using the console](#using-the-console)
- [API overview](#api-overview)
- [Threat correlation: how to interpret links](#threat-correlation-how-to-interpret-links)
- [Tests and verification](#tests-and-verification)
- [Repository structure](#repository-structure)
- [Troubleshooting](#troubleshooting)
- [Security and responsible use](#security-and-responsible-use)

## What it does

- **Agentic honeypot (Node.js):** processes suspicious messages, runs a persona-driven conversation, extracts indicators such as UPI IDs, phone numbers, URLs, and scam phrases, and records session evidence.
- **Threat intelligence:** correlates profiles and sessions using shared indicators, helping analysts explore potentially related activity.
- **Threat relationship graph:** visualizes connected profiles with risk-colored nodes, profile details, search, risk filtering, relationship-type filtering, refresh, and JSON export.
- **ML analysis (Python/Flask):** provides scam, phishing, fake-news, behavior, and other risk-analysis modules available in the integrated service.
- **Risk fusion:** combines available signals into an explainable result. ML enrichment is optional; the gateway can fall back to rule-based detection when the ML service is unavailable or times out.
- **Analyst console (React/Vite):** provides workflows for honeypot sessions, detection, intelligence, alerts, analytics, risk analysis, and reports.
- **Persistence (MongoDB):** stores application records such as sessions, conversation turns, profiles, alerts, and analytics.

The availability and accuracy of individual ML models depend on their artifacts, Python dependencies, and configuration. A running server does not necessarily mean every model is loaded and healthy; check the system status shown by the application.

## Architecture

```text
Browser
  └── React + Vite console (frontend/)
        └── Node.js / Express gateway (src/, default port 3000)
              ├── Honeypot agent and detection (agent/, detection/)
              ├── API routes, services, risk fusion and threat intelligence
              ├── MongoDB persistence
              └── ML bridge
                    └── Python / Flask service (ml/, default port 5050)
```

By default, the Node gateway starts and supervises the Python ML service. Set `ML_AUTO_START=false` if you intend to manage the Python service separately. If ML is unavailable, some workflows may continue with rule-based detection rather than full model enrichment.

## Technology stack

| Layer | Technologies |
|---|---|
| Web console | React, Vite, JavaScript, CSS |
| API gateway | Node.js, Express |
| Honeypot and threat intelligence | JavaScript, application services and detection rules |
| ML service | Python, Flask, model-loading and analysis modules |
| Database | MongoDB, Mongoose |
| Optional LLM integration | Gemini-compatible API key configuration |
| Testing | Node.js test scripts, staged readiness checks, optional browser tests |

## Requirements

- Node.js 18 or newer
- Python 3.10 or newer
- MongoDB, local or hosted
- npm
- Optional: an LLM API key for model-generated agent responses
- Optional: supported browser binaries for browser-based readiness checks

Check your installed versions:

```bash
node --version
npm --version
python --version
```

## Quick start

### 1. Get the code

```bash
git clone https://github.com/TejashRajuKV/Agentic-honey-pot-system.git
cd Agentic-honey-pot-system
```

### 2. Configure environment variables

Copy `.env.example` to `.env`, then edit the values for your machine. For example, on Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

At minimum, configure a working `MONGODB_URI` and replace the example `API_KEY` with a long, random secret. Do not commit your real `.env` file or share API keys.

### 3. Install dependencies

From the repository root:

```bash
npm run install:all
```

This installs the root Node dependencies, frontend dependencies, and Python packages from `requirements.txt`. If you use a Python virtual environment, activate it before installing the Python dependencies and ensure the gateway uses the intended Python executable through `PYTHON_BIN`.

### 4. Build and start

```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For development with frontend hot reload, run:

```bash
npm run dev
```

The development script runs the gateway and Vite development server; the frontend is typically available at [http://localhost:5173](http://localhost:5173). Keep the terminal open to see startup messages and errors.

## Configuration

Values are loaded from environment variables. See [`.env.example`](.env.example) for the starter configuration.

| Variable | Purpose |
|---|---|
| `PORT` | Express gateway port; default `3000` |
| `MONGODB_URI` | MongoDB connection string |
| `API_KEY` | API key required by `POST /api/v1/messages`; replace the example value |
| `LLM_API_KEY` | Optional key for LLM-generated agent responses; rule-based fallback may be used when absent |
| `EVALUATION_CALLBACK_URL` | Optional evaluator callback override for staging/testing; otherwise the configured default is used |
| `ML_PORT` | Python ML service port; default `5050` |
| `CYBERRAKSHAK_URL` | ML service base URL; defaults to loopback |
| `ML_AUTO_START` | Set to `false` to manage the Python service separately |
| `PYTHON_BIN` | Optional Python executable override |
| `ML_TIMEOUT_MS` | Timeout for optional ML bridge calls; default `2500` ms |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins |
| `JSON_BODY_LIMIT` | Express JSON request body limit; default `1mb` |
| `HIBP_API_KEY` | Optional Have I Been Pwned breach-lookup key |
| `DB_BUFFER_TIMEOUT_MS` | MongoDB buffering timeout in milliseconds |

The default CORS allowlist is `http://localhost:5173,http://localhost:3000`. Only add origins you control. CORS is not an authentication mechanism.

## Using the console

Once the app and its required services are running:

1. Check the system status/health information to confirm which subsystems are available.
2. Submit or inspect suspicious messages using the available honeypot and detection workflows.
3. Review session evidence and extracted indicators.
4. Open the threat relationship graph to explore profiles connected by shared indicators.
5. Use search, risk filtering, and relationship-type filtering to narrow the graph; select a node to inspect its profile.
6. Export the currently displayed graph as JSON when you need to retain or analyze the view.

The graph is an investigative aid. A shared indicator can be reused, spoofed, or belong to multiple people; a graph connection is not proof that two profiles represent the same person.

## API overview

The exact routes and payloads are defined in the current route and controller files under `src/`. This table is a high-level orientation, not a complete API specification.

| Route | Purpose | Authentication status documented in this repository |
|---|---|---|
| `GET /`, `GET /api/v1/health` | Liveness/health checks | Public |
| `POST /api/v1/messages` | Evaluator/honeypot message pipeline | Requires `x-api-key` |
| `GET /api/v1/system/status` | Subsystem diagnostics | Currently public |
| `/api/v1/ml/*` | ML gateway endpoints | Currently public |
| `/api/v1/console/*` | Console workflows | Currently public |
| `/api/v1/analytics/*`, `/api/v1/intelligence/*`, `/api/v1/profiles/*`, `/api/v1/alerts/*`, `/api/v1/quality/*`, `/api/v1/reports/*`, `/api/v1/language/*` | Console data and configuration workflows | Currently public |

For the message endpoint, send the configured key in the `x-api-key` header. Do not assume that other routes are protected merely because this endpoint is.

## Threat correlation: how to interpret links

The threat graph uses shared indicators such as UPI IDs, phone numbers, and URLs to connect profiles when the underlying intelligence data provides those relationships. The relationship-type filter lets you view all links or focus on one indicator type.

- A connection means the system found a shared indicator; it is a lead for review, not a verified attribution.
- Missing or older identifier fields may be treated as empty, so legacy profiles do not necessarily break correlation.
- URL matches depend on the URL values extracted and stored by the application; visually similar URLs are not necessarily treated as equivalent.
- Risk scores and extracted indicators can be incomplete or incorrect. Verify evidence independently before making consequential decisions.

## Tests and verification

Run commands from the repository root after installing dependencies.

```bash
# Build the production frontend
npm run build

# Focused threat-network correlation checks
npm run test:threat-network

# Feature / end-to-end suite
npm test

# Staged readiness suite (some stages need MongoDB and browser support)
npm run test:readiness

# Run a single readiness sprint
node tests/readiness/run.js 1
```

Tests have different prerequisites. The readiness suite may require MongoDB, browser binaries, Python dependencies, and model artifacts. Check the command's exit code and failure summary for your environment. **A test script existing is not evidence that it passes.** Run the relevant checks after making changes and before merging or deploying.

## Repository structure

```text
src/                  Express gateway, routes, controllers, services and models
agent/                Persona agent, state machine, response safety and callbacks
detection/             Scam detection and intelligence extraction
ml/                    Python/Flask ML service, routes, training and model loader
frontend/              React + Vite analyst console
shared-contracts/      Shared constants and contracts
scripts/               Development and end-to-end scripts
tests/                 Feature tests and staged readiness suite
docs/                  Reference documentation and historical subsystem notes
```

Older material under `docs/cyberrakshak/` may describe earlier standalone components. For the integrated application, use this README together with the current route, service, and configuration files as the primary source of truth.

## Troubleshooting

- **MongoDB connection errors:** confirm MongoDB is running and that `MONGODB_URI` points to the correct database.
- **ML service shows degraded/unavailable:** check Python is installed, dependencies in `requirements.txt` are available, model artifacts exist where expected, and `PYTHON_BIN` is correct if overridden.
- **Port already in use:** change `PORT` or stop the process using that port; configure `ML_PORT` separately if needed.
- **Frontend does not load after a code change:** run `npm run build` and inspect the build output. During development, check the Vite and gateway terminals.
- **Readiness tests fail:** read the first failing stage and confirm its prerequisites; not every test is intended to run without a database, browser, or model files.

## Security and responsible use

- Treat this as a development project until its security controls and deployment setup have been reviewed.
- Do not expose unauthenticated console, ML, analytics, intelligence, profile, alert, or configuration endpoints to untrusted networks.
- Use strong secrets and keep them out of source control, screenshots, logs, and frontend bundles.
- Restrict evaluator/webhook callback destinations to trusted hosts and review any endpoint that can change callback configuration to prevent server-side request forgery or misuse.
- Keep the ML service bound to loopback unless remote access is deliberately secured.
- Collect only the data required for analysis, restrict access to stored evidence, and define retention and deletion policies.
- Use the platform for authorized defensive testing and investigation. Do not treat model scores or shared indicators as conclusive proof of malicious activity or identity.
