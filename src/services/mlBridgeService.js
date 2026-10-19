// src/services/mlBridgeService.js
// Optional bridge to the Python ML engine. Failures degrade to rule-based detection.

const CYBERRAKSHAK_URL = (process.env.CYBERRAKSHAK_URL || `http://127.0.0.1:${process.env.ML_PORT || 5050}`).replace(/\/+$/, "");
const ML_TIMEOUT_MS = Math.max(250, Number.parseInt(process.env.ML_TIMEOUT_MS || "2500", 10) || 2500);

async function request(path, body, timeoutMs = ML_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${CYBERRAKSHAK_URL}${path}`, {
            method: body === undefined ? "GET" : "POST",
            headers: body === undefined ? {} : { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        // ML is an enhancement, not a hard dependency. Keep the caller operational
        // when Python is warming up, offline, timing out, or returns invalid JSON.
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {string} message
 * @returns {Promise<{confidence: number, reason: string, flagged_words: string[], scam_category: string} | null>}
 */
async function getMLScamConfidence(message) {
    if (typeof message !== "string" || !message.trim()) return null;
    const data = await request("/api/scam", { message: message.slice(0, 4000) });
    if (!data) return null;

    const rawConfidence = Number(data.confidence);
    const confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(100, rawConfidence))
        : 0;
    return {
        confidence,
        reason: typeof data.reason === "string" ? data.reason : "",
        flagged_words: Array.isArray(data.flagged_words) ? data.flagged_words : [],
        scam_category: typeof data.scam_category === "string" ? data.scam_category : "Unknown",
    };
}

/**
 * @param {{message?: string, url?: string, app?: string}} input
 * @returns {Promise<object | null>}
 */
async function getMLThreatAnalysis(input = {}) {
    const safeInput = {
        ...(typeof input.message === "string" ? { message: input.message.slice(0, 4000) } : {}),
        ...(typeof input.url === "string" ? { url: input.url.slice(0, 2048) } : {}),
        ...(typeof input.app === "string" ? { app: input.app.slice(0, 200) } : {}),
    };
    return request("/api/threat", safeInput);
}

/** @returns {Promise<boolean>} */
async function isCyberRakshakReachable() {
    return Boolean(await request("/api/health", undefined, 1000));
}

module.exports = { getMLScamConfidence, getMLThreatAnalysis, isCyberRakshakReachable };
