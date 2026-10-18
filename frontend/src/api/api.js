import axios from "axios";
import ENDPOINTS from "./endpoints";

// ─────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────
const api = axios.create({
  baseURL: "",   // same origin — the platform gateway serves the UI and every API
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,
});


// ─────────────────────────────────────────
// Scam Radar
// ─────────────────────────────────────────
export const analyzeScam = async (message) => {
  const response = await api.post(ENDPOINTS.SCAM, { message });
  return response.data;
};


// ─────────────────────────────────────────
// Behavior Monitor
// ─────────────────────────────────────────
export const analyzeBehavior = async (behaviorData) => {
  const response = await api.post(ENDPOINTS.BEHAVIOR, behaviorData);
  return response.data;
};


// ─────────────────────────────────────────
// Fake News Checker
// ─────────────────────────────────────────
export const analyzeNews = async (text) => {
  const response = await api.post(ENDPOINTS.FAKENEWS, { text });
  return response.data;
};


// ─────────────────────────────────────────
// Loan Risk Scanner
// ─────────────────────────────────────────
export const scoreLoan = async (appData) => {
  const response = await api.post(ENDPOINTS.LOAN, appData);
  return response.data;
};


// ─────────────────────────────────────────
// Get Loan Rules (for checklist UI)
// ─────────────────────────────────────────
export const getLoanRules = async () => {
  const response = await api.get(ENDPOINTS.LOAN_RULES);
  return response.data;
};


// ─────────────────────────────────────────
// Quick loan-app database lookup (RBI verified / blacklisted)
// ─────────────────────────────────────────
export const checkLoanApp = async (name) => {
  const response = await api.get(ENDPOINTS.LOAN_CHECK_APP, { params: { name } });
  return response.data;
};


// ─────────────────────────────────────────
// Phishing Detector
// ─────────────────────────────────────────
export const analyzePhishing = async (url) => {
  const response = await api.post(ENDPOINTS.PHISHING, { url });
  return response.data;
};


// ─────────────────────────────────────────
// Threat Analyzer (combined message + URL + app)
// ─────────────────────────────────────────
export const analyzeThreat = async (payload) => {
  const response = await api.post(ENDPOINTS.THREAT, payload);
  return response.data;
};


// ─────────────────────────────────────────
// Platform status: gateway + ML engine + database + agent
// ─────────────────────────────────────────
export const getSystemStatus = async () => {
  const response = await api.get(ENDPOINTS.STATUS, { timeout: 6000 });
  return response.data?.data;
};

export const getVersion = async () => {
  const response = await api.get(ENDPOINTS.ML_VERSION);
  return response.data;
};


export default api;
