# Integration Coverage Matrix

This file documents what is present in the current combined repository. It is **not** a claim that every feature from an earlier/original CyberRakshak repository has been preserved; that requires a file-by-file comparison against that source repository.

## CyberRakshak detection modules

| Feature | Frontend | Python API | Readiness reporting |
|---|---|---|---|
| Scam Radar | `frontend/src/modules/ScamRadar.jsx` | `POST /api/scam` | `scam_radar` model flag |
| Behavior Anomaly | `frontend/src/modules/BehaviorMonitor.jsx` | `POST /api/behavior` | `behavior_monitor` model flag |
| Fake News Checker | `frontend/src/modules/FakeNewsChecker.jsx` | `POST /api/fakenews` | `fake_news` model flag |
| Phishing Detector | `frontend/src/modules/PhishingDetector.jsx` | `POST /api/phishing` | `phishing_detector` model flag |
| Loan Risk Scanner | `frontend/src/modules/LoanRiskScanner.jsx` | `POST /api/loan`, `GET /api/loan/rules`, `GET /api/loan/check-app` | `loan_scorer`; rule-based, no serialized model required |
| Multi-Vector Threat Analyzer | `frontend/src/modules/ThreatAnalyzer.jsx` | `POST /api/threat` | `multi_vector_analyzer`; composite endpoint, not a separate model artifact |

The Node gateway exposes the Python routes through `/api/v1/ml/*`. The ML status response distinguishes serialized model readiness from rule-based/composite endpoint availability.

## Agentic Honey-Pot and analyst console

| Dashboard area | What it covers | Main frontend component |
|---|---|---|
| Autonomous Honeypot | Live engagement and conversation/session review | `LiveEngagement.jsx`, `Sessions.jsx` |
| Threat Intelligence | Harvested indicators and identifier database | `ThreatIntel.jsx` |
| Scammer Intelligence | Profiles, campaigns, relationship graph, archetypes/vulnerability | `Profiles.jsx`, `Campaigns.jsx`, `ThreatGraph.jsx`, `Archetypes.jsx` |
| Protection | Risk fusion and alerts | `Protection.jsx`, `Alerts.jsx` |
| Analytics | Metrics/trends, quality scores, language analysis | `Overview.jsx`, `Quality.jsx`, `LanguageLab.jsx` |
| Reports | Case reports | `Reports.jsx` |
| Integrations | Runtime status of ML, database, LLM, callbacks and alerts | `Integrations.jsx` |

## Important runtime caveats

- A visible dashboard module means its UI and route are included; it does not prove its model artifacts are installed or that it passes live requests.
- The ML health endpoint reports missing serialized models as partial readiness. Loan scoring is rule-based, and Multi-Vector is a composite endpoint.
- The Python ML engine can be offline while the Node gateway still starts; in that state, ML requests can return service-unavailable errors.
- Database-backed honeypot history, profiles, reports, and analytics depend on MongoDB being connected.
- This matrix reflects the current repository only. To prove parity with the original CyberRakshak project, compare this list against the original repository's complete feature inventory and tests.
