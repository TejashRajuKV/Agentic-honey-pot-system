// src/services/mlBridgeService.js
// Calls the CyberRakshak Flask backend for ML-based scam/threat analysis.
// All calls are non-blocking: if Flask is offline the honeypot continues normally.

const CYBERRAKSHAK_URL = process.env.CYBERRAKSHAK_URL || `http://127.0.0.1:${process.env.ML_PORT || 5050}`;
const ML_TIMEOUT_MS = 2500;

/**
 * Fetch ML scam confidence from CyberRakshak for a given message.
 * Returns null on any error so callers can fall back gracefully.
 *
 * @param {string} message - The raw message text
 * @returns {Promise<{confidence: number, reason: string, flagged_words: string[]} | null>}
 */
async function getMLScamConfidence(message) {
    if (!message || typeof message !== "string") return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    try {
        const response = await fetch(`${CYBERRAKSHAK_URL}/api/scam`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        const data = await response.json();

        return {
            confidence: data.confidence ?? 0,
            reason: data.reason ?? "",
            flagged_words: data.flagged_words ?? [],
            scam_category: data.scam_category ?? "Unknown",
        };
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/**
 * Fetch unified threat analysis from CyberRakshak.
 * Accepts message, url, and optional app name.
 *
 * @param {{message?: string, url?: string, app?: string}} input
 * @returns {Promise<{overall_confidence: number, threats: any[]} | null>}
 */
async function getMLThreatAnalysis(input = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    try {
        const response = await fetch(`${CYBERRAKSHAK_URL}/api/threat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) return null;

        return await response.json();
    } catch {
        clearTimeout(timer);
        return null;
    }
}

/**
 * Check if the CyberRakshak Flask backend is reachable.
 * @returns {Promise<boolean>}
 */
async function isCyberRakshakReachable() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);

    try {
        const response = await fetch(`${CYBERRAKSHAK_URL}/api/health`, {
            signal: controller.signal,
        });
        clearTimeout(timer);
        return response.ok;
    } catch {
        clearTimeout(timer);
        return false;
    }
}

module.exports = { getMLScamConfidence, getMLThreatAnalysis, isCyberRakshakReachable };
