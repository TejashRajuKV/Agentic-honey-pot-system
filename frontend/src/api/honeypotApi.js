// honeypotApi.js — client for the honeypot half of the platform (agent, sessions, reports,
// profiles, threat intel, alerts, quality, language). Same-origin: served by the gateway.

import axios from "axios";

const client = axios.create({
    baseURL: "/api/v1",
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
});

const data = (res) => res.data?.data ?? res.data;

// ── Live engagement (agent) ──────────────────────────────
export const engageAgent = (sessionId, message) =>
    client.post("/console/messages", { sessionId, message }).then((r) => r.data);

export const analyzeMessage = (message) => client.post("/console/analyze", { message }).then(data);
export const getIntelSummary = () => client.get("/console/intelligence/summary").then(data);

export const assessRisk = (input) => client.post("/console/risk", input).then(data);
export const getKillChain = (id) => client.get(`/console/sessions/${encodeURIComponent(id)}/killchain`).then(data);
export const getCampaigns = (minSessions = 1) => client.get("/console/campaigns", { params: { minSessions } }).then(data);
export const stixExportUrl = (sessionId) => `/api/v1/console/stix?download=true${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ""}`;
export const getIncidents = () => client.get("/console/incidents", { params: { limit: 30 } }).then(data);
export const resolveIncident = (id) => client.post(`/console/incidents/${encodeURIComponent(id)}/resolve`, {}).then(data);

// ── Sessions ─────────────────────────────────────────────
export const listSessions = (params = {}) =>
    client.get("/console/sessions", { params }).then((r) => r.data.data);
export const getSession = (id) =>
    client.get(`/console/sessions/${encodeURIComponent(id)}`).then(data);

// ── Analytics ────────────────────────────────────────────
export const getDashboard = () => client.get("/analytics/dashboard").then(data);
export const getTrends = (days = 7) => client.get("/analytics/trends", { params: { days } }).then(data);
export const getHeatmap = (days = 30) => client.get("/analytics/heatmap", { params: { days } }).then(data);
export const getTopScammers = (limit = 5) => client.get("/analytics/top-scammers", { params: { limit } }).then(data);
export const getLanguageStats = (days = 30) => client.get("/analytics/language-stats", { params: { days } }).then(data);
export const aggregateAnalytics = () => client.post("/analytics/aggregate", {}).then(data);

export const getAuditTrail = (id) => client.get(`/console/sessions/${encodeURIComponent(id)}/audit`).then(data);
export const getAuditStats = () => client.get("/console/audit/stats").then(data);
export const getKnownIdentifiers = (limit = 50) => client.get("/console/known-identifiers", { params: { limit } }).then(data);
export const analyticsExportUrl = (format, days = 30) => `/api/v1/analytics/export?format=${format}&days=${days}`;

// ── Reports ──────────────────────────────────────────────
export const getTimeline = (id) => client.get(`/reports/${encodeURIComponent(id)}/timeline`).then(data);
export const getJsonReport = (id) => client.get(`/reports/${encodeURIComponent(id)}/json`).then(data);
export const listReports = () => client.get("/reports/list").then(data);
export const generateReport = (sessionId, format = "pdf") => client.post("/reports/generate", { sessionId, format }).then(data);
export const pdfReportUrl = (id) => `/api/v1/reports/${encodeURIComponent(id)}/pdf`;
export const jsonReportUrl = (id) => `/api/v1/reports/${encodeURIComponent(id)}/json?download=true`;

// ── Scammer profiles & threat intelligence ───────────────
export const listProfiles = (params = {}) => client.get("/profiles", { params }).then(data);
export const getThreatFeed = (limit = 20) => client.get("/intelligence/threats", { params: { limit, status: "active" } }).then(data);
export const buildProfile = (sessionId) => client.post("/profiles/analyze", { sessionId }).then(data);
export const matchProfiles = (profileId) => client.get(`/profiles/match/${encodeURIComponent(profileId)}`).then(data);
export const getThreatReport = (profileId) => client.get(`/intelligence/profile/${encodeURIComponent(profileId)}`).then(data);
export const getThreatNetwork = () => client.get("/intelligence/network").then(data);
export const correlateSession = (sessionId) => client.post("/intelligence/correlate", { sessionId }).then(data);
export const checkKnownThreat = (ids) => client.post("/intelligence/check", ids).then(data);

// ── Alerts ───────────────────────────────────────────────
export const getAlertConfig = () => client.get("/alerts/config").then(data);
export const saveAlertConfig = (config) => client.put("/alerts/config", config).then(data);
export const testWebhook = (webhookUrl, auth) => client.post("/alerts/test", { webhookUrl, auth }).then(data);
export const getAlertHistory = () => client.get("/alerts/history").then(data);
export const getAlertStats = () => client.get("/alerts/stats").then(data);

// ── Quality ──────────────────────────────────────────────
export const getQualityMetrics = () => client.get("/quality/metrics").then(data);
export const getQualityTurns = (id) => client.get(`/quality/session/${encodeURIComponent(id)}`).then(data);
export const getRepetition = (id) => client.get(`/quality/repetition/${encodeURIComponent(id)}`).then(data);
export const getQualityReport = (id) => client.get(`/quality/report/${encodeURIComponent(id)}`).then(data);

// ── Language ─────────────────────────────────────────────
export const detectLanguage = (text) => client.post("/language/detect", { text }).then(data);
export const analyzeHinglish = (text) => client.post("/language/analyze-hinglish", { text }).then(data);
export const getScamPhrases = () => client.get("/language/scam-phrases").then(data);
export const getSessionLanguage = (id) => client.get(`/language/stats/${encodeURIComponent(id)}`).then(data);
