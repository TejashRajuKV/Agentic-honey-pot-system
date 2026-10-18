// src/services/killChainService.js
// Turns a stored conversation into a scam kill-chain: which tactics the scammer used on each message,
// which stage of the attack they had reached, how the pressure built up, and how often they changed
// approach. Purely rule-based and deterministic, so the same transcript always gives the same result.
//
// Stage taxonomy follows the social-engineering → financial-theft progression described in
// MITRE ATT&CK (T1566 phishing / T1598 phishing for information / T1657 financial theft).

const ConversationTurn = require('../models/ConversationTurn');

const STAGES = [
    { id: 'RECONNAISSANCE',        label: 'Reconnaissance',            description: 'Opens contact, probes who the victim is' },
    { id: 'TRUST_BUILDING',        label: 'Trust building',            description: 'Claims authority or a legitimate reason to call' },
    { id: 'SOCIAL_ENGINEERING',    label: 'Social engineering',        description: 'Creates urgency, fear or greed to cut off thinking' },
    { id: 'CREDENTIAL_OR_PAYMENT', label: 'Credential / payment ask',  description: 'Asks for OTP, PIN, documents, a link click or money' },
    { id: 'FINANCIAL_THEFT',       label: 'Financial theft attempt',   description: 'Concrete demand: amount + destination, or remote access to the device' },
];
const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

// tactic id → { stage, patterns, pressure }
const TACTICS = {
    INFORMATION_GATHERING: { stage: 'RECONNAISSANCE', patterns: [/\b(is this|am i speaking|confirm (your|the) (name|number)|your (full )?name|date of birth|which bank|kaun bol|aap ka naam)\b/i, /\b(hello|hi|namaste|good (morning|afternoon|evening))\b.{0,40}\b(sir|madam|ji)\b/i] },
    AUTHORITY_IMPERSONATION: { stage: 'TRUST_BUILDING', patterns: [/\b(i am|this is|calling|speaking) (from|with|at)\b.{0,50}\b(bank|sbi|hdfc|icici|axis|rbi|police|cbi|customs|court|income tax|trai|telecom|customer (care|support)|kyc team|cyber)/i, /\b(official|authorized|verification (team|department)|nodal officer|senior officer)\b/i] },
    REWARD_LURE: { stage: 'TRUST_BUILDING', patterns: [/\b(congratulations|you (have )?won|lucky (draw|winner)|cashback|reward|prize|gift|lottery|selected for|bonus|refund (is )?(pending|approved|ready))\b/i] },
    URGENCY: { stage: 'SOCIAL_ENGINEERING', pressure: 1, patterns: [/\b(urgent|immediately|right now|at once|asap|within \d+\s*(min|hour|hr|day)|last chance|expires? (today|soon)|final (notice|warning)|abhi|turant|jaldi)\b/i] },
    THREAT: { stage: 'SOCIAL_ENGINEERING', pressure: 2, patterns: [/\b(blocked|suspended|frozen|freeze|deactivat|terminated|legal action|police (case|complaint)|fir\b|arrest|warrant|penalty|fine\b|court|jail|band ho|block ho)\b/i] },
    EMOTIONAL_MANIPULATION: { stage: 'SOCIAL_ENGINEERING', pressure: 1, patterns: [/\b(your (son|daughter|family|relative)|accident|emergency|hospital|please help|trust me|only you can|i will lose my job)\b/i] },
    OTP_OR_CREDENTIAL_REQUEST: { stage: 'CREDENTIAL_OR_PAYMENT', patterns: [/\b(otp|one[- ]time (password|pin)|cvv|card (number|details)|pin\b|password|net ?banking|aadhaar|pan (card|number)|verification code|code (you|that) (received|got)|share (the )?code)\b/i] },
    LINK_PUSH: { stage: 'CREDENTIAL_OR_PAYMENT', patterns: [/https?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(xyz|top|tk|ml|click|link|in|com)\/\S*|\b(click|tap|open) (the |this )?(link|url)\b/i] },
    PAYMENT_REQUEST: { stage: 'CREDENTIAL_OR_PAYMENT', patterns: [/\b(pay|send|transfer|deposit|remit)\b.{0,40}(₹|rs\.?|inr|\d{2,})/i, /[a-z0-9._-]{2,}@[a-z]{2,}\b/i, /\b(processing fee|registration fee|advance|security deposit|upi id|collect request|scan (the )?qr)\b/i] },
    REMOTE_ACCESS_REQUEST: { stage: 'FINANCIAL_THEFT', patterns: [/\b(anydesk|teamviewer|quicksupport|screen ?share|remote (access|support)|install (this |the )?app|download (this |the )?app|apk)\b/i] },
};

function tagMessage(text) {
    const tactics = [];
    for (const [id, def] of Object.entries(TACTICS)) {
        if (def.patterns.some((re) => re.test(text))) tactics.push(id);
    }
    // A concrete amount + a destination in the same message is an explicit theft demand
    const hasAmount = /(₹|rs\.?|inr)\s*[\d,]+|\b[\d,]{3,}\s*(rupees|rs)\b/i.test(text);
    const hasDestination = tactics.includes('PAYMENT_REQUEST') || tactics.includes('LINK_PUSH');
    let stage = 'RECONNAISSANCE';
    for (const t of tactics) {
        if (STAGE_INDEX[TACTICS[t].stage] > STAGE_INDEX[stage]) stage = TACTICS[t].stage;
    }
    if (hasAmount && hasDestination) stage = 'FINANCIAL_THEFT';
    const pressure = tactics.reduce((n, t) => n + (TACTICS[t].pressure || 0), 0);
    return { tactics, stage, pressure };
}

/** @returns kill-chain analysis for a session, or null if it has no scammer messages */
async function analyzeSession(sessionId) {
    const turns = await ConversationTurn.find({ sessionId }).sort({ turnIndex: 1 }).lean();
    const scammer = turns.filter((t) => t.role === 'user');
    if (!scammer.length) return null;

    let peak = 'RECONNAISSANCE';
    let prev = null;                 // { primary, stage } of the previous scammer message
    let lateralChanges = 0;          // changed story / tactic WITHOUT progressing along the chain
    let escalations = 0;             // moved further along the chain
    const timeline = scammer.map((t, i) => {
        const tag = tagMessage(t.text);
        if (STAGE_INDEX[tag.stage] > STAGE_INDEX[peak]) peak = tag.stage;
        // primary tactic = the one furthest along the chain (ties: more pressure)
        const primary = [...tag.tactics].sort((a, b) =>
            (STAGE_INDEX[TACTICS[b].stage] - STAGE_INDEX[TACTICS[a].stage]) || ((TACTICS[b].pressure || 0) - (TACTICS[a].pressure || 0)))[0] || null;
        if (i > 0 && primary && prev) {
            if (STAGE_INDEX[tag.stage] > STAGE_INDEX[prev.stage]) escalations += 1;
            else if (primary !== prev.primary) lateralChanges += 1;
        }
        if (primary) prev = { primary, stage: tag.stage };
        return {
            turn: i + 1,
            timestamp: t.timestamp,
            text: t.text.length > 140 ? `${t.text.slice(0, 137)}…` : t.text,
            tactics: tag.tactics,
            primaryTactic: primary,
            stage: tag.stage,
            peakStageSoFar: peak,
            pressure: tag.pressure,
        };
    });

    const pressureCurve = timeline.map((t) => t.pressure);
    const half = Math.ceil(pressureCurve.length / 2);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const early = avg(pressureCurve.slice(0, half));
    const late = avg(pressureCurve.slice(half));
    const tacticCounts = {};
    timeline.forEach((t) => t.tactics.forEach((x) => { tacticCounts[x] = (tacticCounts[x] || 0) + 1; }));

    return {
        sessionId,
        stages: STAGES,
        peakStage: peak,
        stageProgress: Math.round(((STAGE_INDEX[peak] + 1) / STAGES.length) * 100),
        stagesReached: STAGE_INDEX[peak] + 1,
        timeline,
        tacticCounts,
        pressure: {
            curve: pressureCurve,
            trend: scammer.length < 2 ? 'insufficient_data' : late > early ? 'escalating' : late < early ? 'easing' : 'steady',
            peak: Math.max(0, ...pressureCurve),
        },
        adaptation: {
            escalations,
            tacticSwitches: lateralChanges,
            score: scammer.length > 1 ? Math.min(100, Math.round((lateralChanges / (scammer.length - 1)) * 100)) : 0,
            note: 'Share of consecutive scammer messages where the scammer changed approach without progressing along the kill chain (e.g. dropped one story for another). Steady escalation is not counted. Heuristic — needs several turns.',
        },
    };
}

module.exports = { analyzeSession, tagMessage, STAGES, TACTICS };
