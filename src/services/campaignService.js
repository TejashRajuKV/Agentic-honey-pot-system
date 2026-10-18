// src/services/campaignService.js
// Campaign detection: groups honeypot sessions into campaigns when they share infrastructure
// (the same UPI ID, phone number or URL domain). A campaign is "potentially linked" — shared
// infrastructure is evidence of a common operation, NOT proof of a single individual.

const ConversationTurn = require('../models/ConversationTurn');
const Session = require('../models/Session');
const { tagMessage } = require('./killChainService');

const domainOf = (url) => {
    try { return new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`).hostname.replace(/^www\./, '').toLowerCase(); }
    catch { return null; }
};

class UnionFind {
    constructor() { this.p = new Map(); }
    find(x) { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r); this.p.set(x, r); return r; }
    union(a, b) { const ra = this.find(a); const rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

async function detectCampaigns({ minSessions = 1, limit = 30 } = {}) {
    const turns = await ConversationTurn.find({ role: 'user' })
        .sort({ timestamp: -1 }).limit(8000).select('sessionId text timestamp extractedIntel').lean();

    // sessionId -> identifiers seen in that session
    const bySession = new Map();
    for (const t of turns) {
        const e = t.extractedIntel || {};
        const entry = bySession.get(t.sessionId) || { upi: new Set(), phone: new Set(), domain: new Set(), texts: [], first: t.timestamp, last: t.timestamp };
        (e.upiIds || []).forEach((v) => entry.upi.add(v.toLowerCase()));
        (e.phoneNumbers || []).forEach((v) => entry.phone.add(String(v).replace(/\D/g, '').slice(-10)));
        (e.urls || []).forEach((u) => { const d = domainOf(u); if (d) entry.domain.add(d); });
        entry.texts.push(t.text);
        if (t.timestamp < entry.first) entry.first = t.timestamp;
        if (t.timestamp > entry.last) entry.last = t.timestamp;
        bySession.set(t.sessionId, entry);
    }
    for (const [sid, v] of [...bySession]) {
        if (!v.upi.size && !v.phone.size && !v.domain.size) bySession.delete(sid);
    }
    if (!bySession.size) return [];

    const sessions = await Session.find({ sessionId: { $in: [...bySession.keys()] } }).lean();
    const meta = new Map(sessions.map((s) => [s.sessionId, s]));

    // link sessions that share an identifier
    const uf = new UnionFind();
    const owner = new Map();            // "upi:x" -> [sessionIds]
    for (const [sid, v] of bySession) {
        uf.find(sid);
        for (const [kind, set] of [['upi', v.upi], ['phone', v.phone], ['domain', v.domain]]) {
            for (const val of set) {
                const key = `${kind}:${val}`;
                owner.set(key, [...(owner.get(key) || []), sid]);
                if (owner.get(key).length > 1) uf.union(owner.get(key)[0], sid);
            }
        }
    }

    const groups = new Map();
    for (const sid of bySession.keys()) {
        const root = uf.find(sid);
        groups.set(root, [...(groups.get(root) || []), sid]);
    }

    const campaigns = [...groups.values()].filter((g) => g.length >= minSessions).map((sids) => {
        const ids = { upiIds: new Set(), phoneNumbers: new Set(), domains: new Set() };
        const scamTypes = {};
        const tactics = {};
        let first = null; let last = null; let maxRisk = 0; let scamSessions = 0;
        for (const sid of sids) {
            const v = bySession.get(sid);
            v.upi.forEach((x) => ids.upiIds.add(x));
            v.phone.forEach((x) => ids.phoneNumbers.add(x));
            v.domain.forEach((x) => ids.domains.add(x));
            const m = meta.get(sid);
            if (m?.scamEverDetected) scamSessions += 1;
            if (m?.scamType) scamTypes[m.scamType] = (scamTypes[m.scamType] || 0) + 1;
            maxRisk = Math.max(maxRisk, m?.maxScamProbability || 0);
            if (!first || v.first < first) first = v.first;
            if (!last || v.last > last) last = v.last;
            v.texts.forEach((txt) => tagMessage(txt).tactics.forEach((t) => { tactics[t] = (tactics[t] || 0) + 1; }));
        }
        const linkEvidence = [...owner.entries()].filter(([, list]) => list.filter((s) => sids.includes(s)).length > 1)
            .map(([key, list]) => ({ identifier: key.replace(':', ' '), sessions: [...new Set(list)].filter((s) => sids.includes(s)).length }));
        const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
        const idCount = ids.upiIds.size + ids.phoneNumbers.size + ids.domains.size;
        const stableId = [...ids.upiIds, ...ids.phoneNumbers, ...ids.domains].sort()[0] || sids[0];
        return {
            campaignId: `CMP-${Buffer.from(stableId).toString('hex').slice(0, 8).toUpperCase()}`,
            linked: sids.length > 1,
            sessions: sids.length,
            scamSessions,
            victimsTargeted: sids.length,
            scamType: top(scamTypes)[0]?.[0] || 'UNCLASSIFIED',
            scamTypes: top(scamTypes).map(([type, count]) => ({ type, count })),
            dominantTactics: top(tactics).slice(0, 4).map(([tactic, count]) => ({ tactic, count })),
            identifiers: { upiIds: [...ids.upiIds], phoneNumbers: [...ids.phoneNumbers], domains: [...ids.domains] },
            identifierCount: idCount,
            firstSeen: first,
            lastSeen: last,
            activeDays: Math.max(1, Math.ceil((new Date(last) - new Date(first)) / 86400000) || 1),
            maxRisk,
            linkEvidence,
            caveat: sids.length > 1
                ? 'Potentially linked: these sessions share infrastructure (identifiers above). This is not proof of a single operator.'
                : 'Single session — no cross-session link yet.',
            sessionIds: sids,
        };
    });

    return campaigns.sort((a, b) => b.sessions - a.sessions || b.maxRisk - a.maxRisk).slice(0, limit);
}

module.exports = { detectCampaigns };
