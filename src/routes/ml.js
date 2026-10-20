// src/routes/ml.js
// Gateway to the CyberRakshak ML engine: /api/v1/ml/<module> → ml engine /api/<module>.
// A plain fetch-forwarder (not a streaming proxy) because express.json() has already
// consumed the request body by the time it reaches here — a stream proxy would hang on POST.

const express = require("express");
const router = express.Router();
const { ML_URL } = require("../services/mlProcessManager");

const ALLOWED = new Set([
    "scam", "behavior", "fakenews", "phishing", "loan",
    "loan/rules", "loan/check-app", "threat", "health", "version",
]);
const TIMEOUT_MS = 20000;
const MAX_QUERY_LENGTH = 2048;
const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readBoundedBody(response, maxBytes) {
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => {});
        return null;
    }

    if (!response.body || typeof response.body.getReader !== "function") {
        const text = await response.text();
        return Buffer.byteLength(text, "utf8") <= maxBytes ? text : null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let result = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
                await reader.cancel().catch(() => {});
                return null;
            }
            result += decoder.decode(value, { stream: true });
        }
        return result + decoder.decode();
    } finally {
        reader.releaseLock();
    }
}

router.all("/*path", async (req, res) => {
    const sub = [].concat(req.params.path).join("/");
    if (!ALLOWED.has(sub)) {
        // Do not echo attacker-controlled path fragments back to callers.
        return res.status(404).json({ error: "Unknown ML endpoint" });
    }
    if (req.method !== "GET" && req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const queryIndex = req.url.indexOf("?");
    const qs = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    if (qs.length > MAX_QUERY_LENGTH) {
        return res.status(414).json({ error: "Query string is too long" });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const upstream = await fetch(`${ML_URL}/api/${sub}${qs}`, {
            method: req.method,
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: req.method === "POST" ? JSON.stringify(req.body || {}) : undefined,
            signal: controller.signal,
            redirect: "error",
        });
        const text = await readBoundedBody(upstream, MAX_RESPONSE_BYTES);
        if (text === null) {
            return res.status(502).json({
                status: "error",
                code: "ML_RESPONSE_TOO_LARGE",
                error: "CyberRakshak ML engine returned an oversized response",
            });
        }
        // Restrict forwarded content types to prevent an upstream response from
        // making the console render arbitrary HTML or other active content.
        const upstreamType = (upstream.headers.get("content-type") || "").toLowerCase();
        const responseType = upstreamType.includes("json")
            ? "application/json; charset=utf-8"
            : "text/plain; charset=utf-8";
        res.status(upstream.status).type(responseType).send(text);
    } catch (err) {
        // Do not expose internal network errors, hostnames, or implementation details.
        const timedOut = err?.name === "AbortError";
        res.status(timedOut ? 504 : 503).json({
            status: "error",
            code: timedOut ? "ML_ENGINE_TIMEOUT" : "ML_ENGINE_UNAVAILABLE",
            error: timedOut
                ? "CyberRakshak ML engine timed out"
                : "CyberRakshak ML engine is temporarily unavailable",
        });
    } finally {
        clearTimeout(timer);
    }
});

module.exports = router;
