# CyberRakshak — Integrated AI Cybersecurity Platform

CyberRakshak brings the **Agentic Honey-Pot** and **CyberRakshak ML suite** into one application, with one React console and one Node.js gateway.

- **Honeypot engine (Node.js):** analyzes suspicious messages, runs a persona-driven conversation, extracts indicators (UPI IDs, phone numbers, URLs and scam phrases), records evidence and can send a final evaluator callback.
- **ML engine (Python/Flask):** scam, fake-news, phishing and behavior models, rule-based loan-app checks, and multi-vector risk analysis.
- **Web console (React/Vite):** threat detection, honeypot sessions, intelligence, risk fusion, alerts, analytics and reports.
- **MongoDB:** persistence for sessions, turns, profiles, alerts and analytics.

## Architecture

```text
Browser
  └── React console (frontend/)
        └── Express gateway (src/, port 3000)
              ├── Honeypot agent + rule-based detection (agent/, detection/)
              ├── ML bridge / risk fusion ──> Flask engine (ml/, 127.0.0.1:5050)
              └── MongoDB
```

The Python engine is started and supervised by Node by default. The gateway degrades to rule-based detection when the ML engine is unavailable; the health panel should show that the ML subsystem is degraded rather than imply all models are ready.

## Requirements

- Node.js 18 or newer
- Python 3.10 or newer
- MongoDB (local or hosted)
- Optional: Gemini API key for LLM-generated agent responses
- Optional: Chrome/Edge for browser readiness tests

## Run locally

1. Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique `API_KEY`.
2. Install the dependencies:

   ```bash
   npm run install:all
   ```

3. Build the React console:

   ```bash
   npm run build
   ```

4. Start the integrated application:

   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000).

For frontend hot reload, use `npm run dev` (gateway on port 3000 and Vite on port 5173).

## Configuration

| Variable | Purpose |
|---|---|
| `PORT` | Express gateway port (default `3000`) |
| `MONGODB_URI` | MongoDB connection string |
| `API_KEY` | Required for `POST /api/v1/messages`; use a long random secret |
| `LLM_API_KEY` | Optional LLM key; rule-based fallback is used when absent |
| `EVALUATION_CALLBACK_URL` | Optional callback override for staging/testing; defaults to the GUVI evaluator |
| `ML_PORT` | Local Flask port (default `5050`) |
| `CYBERRAKSHAK_URL` | ML engine base URL; defaults to loopback |
| `ML_AUTO_START` | Set to `false` when managing the Python engine separately |
| `PYTHON_BIN` | Optional Python executable override |
| `ML_TIMEOUT_MS` | Timeout for optional ML bridge calls (default `2500`) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist for browser origins |
| `JSON_BODY_LIMIT` | Express JSON body limit (default `1mb`) |
| `HIBP_API_KEY` | Optional Have I Been Pwned breach lookup key |
| `DB_BUFFER_TIMEOUT_MS` | MongoDB buffering timeout in milliseconds |

The default CORS allowlist is `http://localhost:5173,http://localhost:3000`. Add only origins you control. The built-in console is same-origin in production and does not need a separate CORS origin.

## Main endpoints

| Endpoint | Purpose | Authentication |
|---|---|---|
| `GET /`, `GET /api/v1/health` | Liveness probes | Public |
| `POST /api/v1/messages` | Evaluator / honeypot message pipeline | `x-api-key` |
| `GET /api/v1/system/status` | Subsystem diagnostics for the console | Currently public |
| `/api/v1/ml/*` | Gateway proxy to ML modules | Currently public |
| `/api/v1/console/*` | Console workflows and intelligence | Currently public |
| `/api/v1/analytics/*`, `/api/v1/intelligence/*`, `/api/v1/profiles/*`, `/api/v1/alerts/*`, `/api/v1/quality/*`, `/api/v1/reports/*`, `/api/v1/language/*` | Console data and configuration APIs | Currently public |

**Important security limitation:** CORS only controls browser cross-origin access; it is not authentication. Several console, ML, analytics, intelligence and alert routes are still unauthenticated, including routes that read or modify stored data and webhook configuration. Do not expose this service directly to the public internet until an authentication/authorization layer and webhook destination policy are in place. Put it behind a trusted network boundary or reverse-proxy authentication in the meantime. The evaluator endpoint retains its API-key check.

## Detection and risk fusion

The message pipeline uses rule-based scam detection and optionally enriches the result with the ML service. The console's risk-fusion workflow combines available signals (message, URL, app, behavior and known identifiers) and returns an explainable score with evidence. ML is an optional enrichment: if the model service is unavailable or times out, the request can continue without it.

## Tests

Run these from the repository root after installing dependencies:

```bash
# Frontend production build
npm run build

# Feature/end-to-end suite
npm test

# Full staged readiness suite (requires MongoDB and browser support)
npm run test:readiness

# A single readiness sprint
node tests/readiness/run.js 1
```

The readiness suite covers static integrity, backend routes, frontend/API wiring, browser workflows, end-to-end flows and failure modes. **A test command existing is not evidence that it passes**; check the exit code and failure summary for your environment. Some tests require MongoDB, browser binaries, serialized model files and Python dependencies.

## Repository layout

```text
src/                  Express gateway, routes, controllers, services and models
agent/                Persona agent, state machine, response safety and callbacks
detection/            Scam detection and intelligence extraction
ml/                   Python/Flask ML service, routes, training and model loader
frontend/              React + Vite console
shared-contracts/      Shared constants and contracts
scripts/               Development and end-to-end scripts
tests/readiness/       Staged readiness suite
docs/                  Reference documentation, including historical subsystem docs
```

The older subsystem documentation under `docs/cyberrakshak/` and legacy sections in previous documentation describe components that predate the integrated app; use this README and the current route/service code as the primary source of truth for the combined project.
