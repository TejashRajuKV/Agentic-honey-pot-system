// src/services/riskFusionService.js
// CyberRakshak Risk Fusion Engine.
//
// Runs every detector that has input to work with (message, URL, app, behaviour, identifiers) and fuses
// their outputs into ONE explainable risk score. Nothing is a black box: every point of the final score is
// attributed to a signal and to the concrete evidence behind it.
//
//   final = (1 - peakBlend) * Σ(normalised weight × signal score)  +  peakBlend * strongest signal
//
// The peak term stops one decisive signal (e.g. a known scammer's UPI ID) being diluted by silent ones.
// Weights are configuration (src/config/riskWeights.json / RISK_WEIGHTS env), not learned constants.

const cfgFile = require('../config/riskWeights.json');
const { detectScamIntent } = require('../../detection/scamDetector');
const { extractIntelligence, extractAmounts } = require('../../detection/intelligenceExtractor');
const { tagMessage } = require('./killChainService');
const { ML_URL } = require('./mlProcessManager');
const ScammerIntelligence = require('../models/ScammerIntelligence');
const ScammerProfile = require('../models/ScammerProfile');

function loadConfig() {
    let override = {};
    try { override = process.env.RISK_WEIGHTS ? JSON.parse(process.env.RISK_WEIGHTS) : {}; } catch { /* ignore bad JSON */ }
    return { ...cfgFile, weights: { ...cfgFile.weights, ...override } };
}

async function ml(path, { method = 'POST', body, query } = {}) {
    try {
        const qs = query ? `?${new URLSearchParams(query)}` : '';
        const res = await fetch(`${ML_URL}/api/${path}${qs}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
            signal: AbortSignal.timeout(8000),
        });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

const RISK_LEVEL_SCORE = { CRITICAL: 95, HIGH: 80, MEDIUM: 55, LOW: 30 };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

async function assess(input = {}) {
    const cfg = loadConfig();
    const message = typeof input.message === 'string' ? input.message.slice(0, 4000) : '';
    const intel = message ? extractIntelligence(message) : { upiIds: [], phoneNumbers: [], urls: [] };
    const upiIds = [...new Set([...(input.upiIds || []), ...intel.upiIds])];
    const phones = [...new Set([...(input.phoneNumbers || []), ...intel.phoneNumbers])];
    const urls = [...new Set([...(input.url ? [input.url] : []), ...intel.urls])].slice(0, 3);
    const app = typeof input.app === 'string' ? input.app.trim() : '';
    const signals = {};   // name -> { score, evidence[] }

    // ── 1. Message intelligence ───────────────────────────
    if (message) {
        const [rule, mlScam] = await Promise.all([
            detectScamIntent(message, [], {}).catch(() => null),
            ml('scam', { body: { message } }),
        ]);
        const ev = [];
        const ruleScore = rule ? Math.round((rule.confidence || 0) * 100) : null;
        const mlScore = mlScam ? mlScam.confidence : null;
        (rule?.reasoning || []).slice(0, 4).forEach((r) => ev.push({ type: 'message', signal: 'rule_engine', detail: r }));
        if (mlScam?.reason) ev.push({ type: 'message', signal: 'ml_scam_model', detail: `${mlScam.scam_category || 'Scam'} model (${mlScore}%): ${mlScam.reason}` });
        const tags = tagMessage(message);
        tags.tactics.forEach((t) => ev.push({ type: 'message', signal: 'tactic', detail: `Tactic detected: ${t.toLowerCase().replace(/_/g, ' ')}` }));
        const scores = [ruleScore, mlScore].filter((x) => x != null);
        if (scores.length) {
            signals.message = {
                score: clamp(Math.max(...scores)),
                evidence: ev,
                meta: { ruleScore, mlScore, scamType: rule?.scamType || null, agreement: scores.length === 2 ? Math.abs(scores[0] - scores[1]) <= 25 : null },
            };
        }

        // identity: authority / brand impersonation
        const idEv = [];
        let idScore = 0;
        if (tags.tactics.includes('AUTHORITY_IMPERSONATION')) { idScore = 60; idEv.push({ type: 'identity', signal: 'authority_claim', detail: 'Claims to be a bank, police or government body' }); }
        if (rule?.scamType && /IMPERSON/.test(rule.scamType)) { idScore = Math.max(idScore, 70); idEv.push({ type: 'identity', signal: 'archetype', detail: `Classified as ${rule.scamType.replace(/_/g, ' ').toLowerCase()}` }); }
        if (idEv.length) signals.identity = { score: idScore, evidence: idEv };
    }

    // ── 2. URL intelligence ───────────────────────────────
    if (urls.length) {
        const results = await Promise.all(urls.map((u) => ml('phishing', { body: { url: u } }).then((r) => ({ u, r }))));
        const ev = [];
        let top = 0;
        for (const { u, r } of results) {
            if (!r) continue;
            top = Math.max(top, r.confidence || 0);
            const detailed = (r.signals || []).filter((s) => s.points >= 10);
            if (detailed.length) detailed.forEach((s) => ev.push({ type: 'url', signal: s.signal, detail: `${u} — ${s.detail}` }));
            else ev.push({ type: 'url', signal: 'phishing_model', detail: `${u} — ${r.reason || 'no structural red flags'} (${r.confidence}%)` });
            const brandSignal = (r.signals || []).find((s) => s.signal === 'brand_impersonation');
            if (brandSignal) {
                signals.identity = signals.identity || { score: 0, evidence: [] };
                signals.identity.score = Math.max(signals.identity.score, 85);
                signals.identity.evidence.push({ type: 'identity', signal: 'brand_impersonation', detail: brandSignal.detail });
            }
        }
        if (ev.length) signals.url = { score: clamp(top), evidence: ev };
    }

    // ── 3. App intelligence (loan-app database) ───────────
    if (app) {
        const r = await ml('loan/check-app', { method: 'GET', query: { name: app } });
        if (r && r.db_status && r.db_status !== 'NOT_CHECKED') {
            const map = { BLACKLISTED: 92, UNVERIFIED: 45, RBI_VERIFIED: 0 };
            const score = map[r.db_status] ?? 40;
            signals.app = {
                score,
                evidence: [{ type: 'app', signal: r.db_status.toLowerCase(), detail: `${r.app_name}: ${r.message || r.db_status}${r.danger_reason ? ` — ${r.danger_reason}` : ''}` }],
            };
        }
    }

    // ── 4. Behavioural anomaly ────────────────────────────
    const b = input.behavior;
    if (b && ['hour', 'amount', 'transactions', 'new_device', 'failed_logins'].every((k) => b[k] !== undefined)) {
        const r = await ml('behavior', { body: b });
        if (r) {
            signals.behavior = {
                score: clamp(r.confidence),
                evidence: [{ type: 'behavior', signal: 'anomaly_model', detail: r.reason || 'Behaviour model result' }],
            };
        }
    }

    // ── 5/6. Threat intelligence + history (identifiers) ──
    if (upiIds.length || phones.length) {
        const [known, profiles] = await Promise.all([
            ScammerIntelligence.find({ $or: [{ upiId: { $in: upiIds } }, { phoneNumber: { $in: phones } }] }).lean(),
            ScammerProfile.find({ $or: [{ 'identifiers.upiIds': { $in: upiIds } }, { 'identifiers.phoneNumbers': { $in: phones } }] }).limit(5).lean(),
        ]);
        if (known.length) {
            const worst = Math.max(...known.map((k) => RISK_LEVEL_SCORE[k.riskLevel] || 50));
            signals.intel = {
                score: clamp(worst + (known.some((k) => k.isBlacklisted) ? 10 : 0)),
                evidence: known.map((k) => ({ type: 'intel', signal: 'known_identifier', detail: `${k.upiId || k.phoneNumber} is in the intelligence database (${k.riskLevel}, seen in ${k.sessionCount} session(s))` })),
            };
            const sessions = Math.max(...known.map((k) => k.sessionCount || 1));
            if (sessions >= 2) {
                signals.history = {
                    score: clamp(35 + sessions * 15),
                    evidence: [{ type: 'history', signal: 'repeat_offender', detail: `Same identifier reappeared across ${sessions} separate honeypot sessions` }],
                };
            }
        }
        if (profiles.length) {
            signals.history = signals.history || { score: 0, evidence: [] };
            signals.history.score = Math.max(signals.history.score, clamp(Math.max(...profiles.map((p) => p.riskScore || 0))));
            profiles.forEach((p) => signals.history.evidence.push({ type: 'history', signal: 'scammer_profile', detail: `Linked to profile ${p.profileId} (risk ${p.riskScore}, tactic ${p.psychologicalProfile?.primaryTactic || 'n/a'})` }));
        }
    }

    // ── Fusion ────────────────────────────────────────────
    const present = Object.keys(signals);
    if (!present.length) {
        return { riskScore: 0, confidence: 0, uncertainty: 1, verdict: 'NO_INPUT', recommendedAction: 'NONE', category: null, signals: {}, evidence: [], breakdown: [], message: 'Provide a message, URL, app name, identifiers or behaviour data to assess.' };
    }
    const totalW = present.reduce((s, k) => s + (cfg.weights[k] || 0), 0) || 1;
    const scores = present.map((k) => signals[k].score);
    const peak = Math.max(...scores);
    const weighted = present.reduce((s, k) => s + ((cfg.weights[k] || 0) / totalW) * signals[k].score, 0);
    const riskScore = clamp((1 - cfg.peakBlend) * weighted + cfg.peakBlend * peak);

    const breakdown = present.map((k) => ({
        signal: k,
        score: signals[k].score,
        weight: Number(((cfg.weights[k] || 0) / totalW).toFixed(3)),
        points: Number((((cfg.weights[k] || 0) / totalW) * signals[k].score * (1 - cfg.peakBlend)).toFixed(1)),
    })).sort((a, b) => b.points - a.points);
    breakdown.push({ signal: 'peak_signal_boost', score: peak, weight: cfg.peakBlend, points: Number((cfg.peakBlend * peak).toFixed(1)) });

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    const coverage = present.length / Object.keys(cfg.weights).length;
    const uncertainty = Number(Math.min(1, 0.5 * (1 - coverage) + 0.5 * (sd / 50)).toFixed(2));

    const verdict = riskScore >= cfg.verdicts.HIGH_RISK ? 'HIGH_RISK' : riskScore >= cfg.verdicts.SUSPICIOUS ? 'SUSPICIOUS' : riskScore >= cfg.verdicts.LOW_RISK ? 'LOW_RISK' : 'LIKELY_SAFE';
    let recommendedAction = 'NONE';
    if (verdict === 'HIGH_RISK') recommendedAction = message ? 'HONEYPOT' : 'BLOCK_AND_REPORT';
    else if (verdict === 'SUSPICIOUS') recommendedAction = 'VERIFY_INDEPENDENTLY';

    const evidence = present.flatMap((k) => {
        const share = breakdown.find((x) => x.signal === k).points / Math.max(1, signals[k].evidence.length);
        return signals[k].evidence.map((e) => ({ ...e, points: Number(share.toFixed(1)) }));
    }).sort((a, b) => b.points - a.points);

    return {
        riskScore,
        confidence: Number((1 - uncertainty).toFixed(2)),
        uncertainty,
        verdict,
        category: signals.message?.meta?.scamType || null,
        recommendedAction,
        signals: Object.fromEntries(present.map((k) => [k, { score: signals[k].score, ...(signals[k].meta ? { meta: signals[k].meta } : {}) }])),
        breakdown,
        evidence,
        extracted: { upiIds, phoneNumbers: phones, urls, amounts: message ? extractAmounts(message) : [] },
        meta: { engine: cfg.version, weights: cfg.weights, peakBlend: cfg.peakBlend, signalsUsed: present, signalsMissing: Object.keys(cfg.weights).filter((k) => !present.includes(k)), evaluatedAt: new Date().toISOString() },
    };
}

module.exports = { assess };
