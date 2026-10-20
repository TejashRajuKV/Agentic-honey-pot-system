# CyberRakshak — Agentic Honeypot & AI Cybersecurity Platform

CyberRakshak is an integrated cybersecurity project that combines an agentic honeypot, threat-intelligence correlation, machine-learning analysis, and a React analyst console behind a Node.js/Express gateway.

> **Status and security note:** This repository is an active development project. Production deployments must configure console authentication secrets, review authorization boundaries, and validate webhook destinations before exposure to untrusted networks.

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

At minimum, configure a working `MONGODB_URI` and replace the example `API_KEY` with a long, random secret. For production, also set `CONSOLE_PASSWORD` (at least 12 characters) and `CONSOLE_SESSION_SECRET` (at least 32 random bytes). The browser console uses a signed, HTTP-only session cookie; do not put these secrets in the frontend. Do not commit your real `.env` file or share API keys.

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
| `CONSOLE_PASSWORD` | Password for the analyst console; at least 12 characters in production |
| `CONSOLE_SESSION_SECRET` | HMAC signing secret for console sessions; at least 32 random bytes in production |
| `LLM_API_KEY` | Optional key for LLM-generated agent responses; rule-based fallback may be used when absent |
| `EVALUATION_CALLBACK_URL` | Optional evaluator callback override for staging/testing; otherwise the configured default is used |
| `ML_PORT` | Python ML service port; default `5050` (takes precedence over the shared `PORT`) |
| `CYBERRAKSHAK_URL` | ML service base URL; defaults to loopback |
| `ML_AUTO_START` | Set to `false` to manage the Python service separately |
| `DEBUG` | Flask debug mode; defaults to `false` and should remain disabled in deployed environments |
| `PYTHON_BIN` | Optional Python executable override |
| `ML_TIMEOUT_MS` | Timeout for optional ML bridge calls; default `2500` ms |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins |
| `JSON_BODY_LIMIT` | Express JSON request body limit; default `1mb` |
| `HIBP_API_KEY` | Optional Have I Been Pwned breach-lookup key |
| `DB_BUFFER_TIMEOUT_MS` | MongoDB buffering timeout in milliseconds |
| `DATA_RETENTION_DAYS` | Retention preview target (30–3650 days; default 365); does not automatically delete records |

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
| `GET /api/v1/system/status` | Subsystem diagnostics | Requires console session when authentication is configured |
| `/api/v1/ml/*` | ML gateway endpoints | Requires console session when authentication is configured |
| `/api/v1/console/*` | Console workflows | Requires console session when authentication is configured |
| `/api/v1/analytics/*`, `/api/v1/intelligence/*`, `/api/v1/profiles/*`, `/api/v1/alerts/*`, `/api/v1/quality/*`, `/api/v1/reports/*`, `/api/v1/language/*` | Console data and configuration workflows | Requires console session when authentication is configured |

For the message endpoint, send the configured key in the `x-api-key` header. The public health probes and `/api/v1/auth/*` session/login endpoints remain unauthenticated. Protected dashboard routes require a signed HTTP-only session when `CONSOLE_PASSWORD` and `CONSOLE_SESSION_SECRET` are configured. In local development, those routes remain accessible when credentials are absent; production intentionally returns `503 CONSOLE_AUTH_NOT_CONFIGURED` until valid credentials are set.

## Investigation and response workspace

The dashboard's **INVESTIGATION & RESPONSE** module provides an investigation center backed by authenticated routes under `/api/v1/investigations`.

| Endpoint | Purpose |
|---|---|
| `GET /cases`, `POST /cases`, `GET /cases/:caseId`, `PATCH /cases/:caseId` | Create, list and update investigation cases |
| `POST /cases/:caseId/notes`, `POST /cases/:caseId/evidence` | Record analyst notes and evidence references; optional evidence content is hashed, not stored |
| `GET /sessions/:sessionId/timeline` | Merge conversation turns and audit events chronologically |
| `POST /copilot/investigate` | Produce deterministic findings linked to stored session evidence; this is not identity attribution or a free-form LLM conclusion |
| `POST /url-analysis` | Static URL triage only; never fetches, resolves or opens the submitted URL |
| `GET /indicators`, `POST /indicators/observe` | Track indicator reputation, sources, observations and expiry |
| `POST /feedback`, `GET /feedback/summary` | Record analyst labels for detection quality review |
| `GET /rules`, `POST /rules`, `PATCH /rules/:ruleId/status`, `POST /rules/replay` | Manage versioned deterministic rules and replay them on sample messages |
| `GET /simulation/scenarios`, `POST /simulation/run` | Run bounded offline synthetic scenarios against enabled rules |
| `GET /operations/overview` | Return operational counts and recent audit activity |
| `GET /playbooks/catalog`, `POST /playbooks/execute` | List and run narrowly allowlisted internal actions after explicit approval |
| `POST /privacy/redact`, `GET /privacy/retention`, `GET /privacy/retention/preview` | Preview PII redaction and estimate records older than a retention target |

All these routes require the analyst console session. Playbooks currently support only internal case creation and indicator recording; they do not block, contact, or retaliate against external systems. Rule replay and simulation do not change production detection. URL analysis is heuristic, not a verdict. Retention endpoints are preview-only and do not delete records. Do not treat indicator overlap, heuristic scores, or model output as proof of attribution.

Run the focused checks with:

```bash
npm run test:investigation-analysis
npm run test:rule-lab
npm run test:simulation-service
npm run test:privacy-service
```

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

The GitHub Actions workflow `.github/workflows/runtime-tests.yml` runs the frontend build, JavaScript syntax checks, focused security/service tests, staged readiness checks, and the end-to-end API suite against a temporary MongoDB service on pushes and pull requests to `main`.

Tests have different prerequisites. The readiness suite may require MongoDB, browser binaries, Python dependencies, and model artifacts. Check the command's exit code and failure summary for your environment. **A test script existing is not evidence that it passes.** Run the relevant checks after making changes and before merging or deploying.

### Verify a deployed service

After the app has been deployed and its public URL is known, run the read-only smoke test:

```bash
npm run smoke:deploy -- https://your-deployed-host
```

It verifies API health, MongoDB connectivity, root health, that the React console is served, the message discovery route, rejection of a message POST without an API key, and the liveness ping. It does not create a session or submit a message. HTTPS is required except for localhost. A successful CI run validates the tested code in CI; it does not prove that a separately hosted production deployment or its secrets and external integrations are configured correctly.

## Repository structure

```text
src/                  Express gateway, routes, controllers, services and models
agent/                Persona agent, state machine, response safety and callbacks
detection/             Scam detection and intelligence extraction
ml/                    Python/Flask ML service, routes, training and model loader
frontend/              React + Vite analyst console
shared-contracts/      Shared constants and contracts
scripts/               Development, end-to-end and deployment smoke-check scripts
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
- Evaluator callback overrides must use public HTTPS destinations; the callback client validates DNS results, pins the validated IP for the request, and does not follow redirects. Keep the default GUVI endpoint unless an alternate evaluator is explicitly required.
- Keep the ML service bound to loopback unless remote access is deliberately secured.
- Collect only the data required for analysis, restrict access to stored evidence, and define retention and deletion policies.
- Use the platform for authorized defensive testing and investigation. Do not treat model scores or shared indicators as conclusive proof of malicious activity or identity.
