// All endpoints are same-origin, served by the platform gateway (Node, port 3000).
//   /api/v1/ml/*        → CyberRakshak ML engine (supervised by the gateway)
//   /api/v1/console/*   → honeypot agent + sessions for the web console
//   /api/v1/*           → analytics, reports, profiles, threat intel, alerts, quality, language
const V1 = "/api/v1";

const ENDPOINTS = {
    // ── ML detection modules ──
    SCAM: `${V1}/ml/scam`,
    BEHAVIOR: `${V1}/ml/behavior`,
    FAKENEWS: `${V1}/ml/fakenews`,
    LOAN: `${V1}/ml/loan`,
    LOAN_RULES: `${V1}/ml/loan/rules`,
    LOAN_CHECK_APP: `${V1}/ml/loan/check-app`,
    PHISHING: `${V1}/ml/phishing`,
    THREAT: `${V1}/ml/threat`,

    // ── Platform ──
    STATUS: `${V1}/system/status`,
    ML_VERSION: `${V1}/ml/version`,

    // ── Honeypot console ──
    CONSOLE_MESSAGE: `${V1}/console/messages`,
    CONSOLE_SESSIONS: `${V1}/console/sessions`,

    // ── Analytics / intelligence ──
    ANALYTICS_DASHBOARD: `${V1}/analytics/dashboard`,
    ANALYTICS_TRENDS: `${V1}/analytics/trends`,
    ANALYTICS_TOP_SCAMMERS: `${V1}/analytics/top-scammers`,
    INTELLIGENCE_SUMMARY: `${V1}/intelligence/summary`,
};

export default ENDPOINTS;
