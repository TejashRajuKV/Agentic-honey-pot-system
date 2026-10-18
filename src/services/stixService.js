// src/services/stixService.js
// Exports harvested threat intelligence as a STIX 2.1 bundle so other CTI tools can ingest it.
//
//   identity (CyberRakshak) ── created_by ──► every object
//   indicator (UPI / phone / URL / domain) ── indicates ──► campaign ── uses ──► attack-pattern (MITRE ATT&CK)
//
// Campaigns are "potentially linked" groupings (see campaignService) — the description says so explicitly.

const crypto = require('crypto');
const { detectCampaigns } = require('./campaignService');

const NAMESPACE = 'cyberrakshak-stix-v1';
// Deterministic UUIDs so re-exporting the same intelligence yields the same object ids
function uuidFor(seed) {
    const h = crypto.createHash('sha1').update(`${NAMESPACE}:${seed}`).digest();
    h[6] = (h[6] & 0x0f) | 0x50;   // version 5
    h[8] = (h[8] & 0x3f) | 0x80;   // RFC 4122 variant
    const x = h.subarray(0, 16).toString('hex');
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
const sid = (type, seed) => `${type}--${uuidFor(`${type}:${seed}`)}`;
const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const ts = (d) => new Date(d || Date.now()).toISOString();

const ATTACK_PATTERNS = [
    { key: 'T1566', name: 'Phishing', description: 'Social-engineering messages that lure victims into revealing credentials or acting on a fraudulent request.', url: 'https://attack.mitre.org/techniques/T1566/' },
    { key: 'T1598', name: 'Phishing for Information', description: 'Messages that solicit sensitive information such as OTPs, PINs and identity documents.', url: 'https://attack.mitre.org/techniques/T1598/' },
    { key: 'T1657', name: 'Financial Theft', description: 'Fraudulent payment demands and impersonation used to steal money.', url: 'https://attack.mitre.org/techniques/T1657/' },
];

async function buildBundle({ sessionId } = {}) {
    let campaigns = await detectCampaigns({ minSessions: 1, limit: 200 });
    if (sessionId) campaigns = campaigns.filter((c) => c.sessionIds.includes(sessionId));

    const created = ts();
    const identity = {
        type: 'identity', spec_version: '2.1', id: sid('identity', 'cyberrakshak'), created, modified: created,
        name: 'CyberRakshak Honeypot Platform', identity_class: 'system', description: 'Automated scam-intelligence collected by the CyberRakshak agentic honeypot.',
    };
    const objects = [identity];
    const base = { spec_version: '2.1', created_by_ref: identity.id };

    const patterns = ATTACK_PATTERNS.map((a) => ({
        ...base, type: 'attack-pattern', id: sid('attack-pattern', a.key), created, modified: created, name: a.name, description: a.description,
        external_references: [{ source_name: 'mitre-attack', external_id: a.key, url: a.url }],
    }));
    if (campaigns.length) objects.push(...patterns);

    const rel = (source, type, target, key) => ({
        ...base, type: 'relationship', id: sid('relationship', `${source}|${type}|${target}|${key}`), created, modified: created,
        relationship_type: type, source_ref: source, target_ref: target,
    });

    for (const c of campaigns) {
        const cid = sid('campaign', c.campaignId);
        objects.push({
            ...base, type: 'campaign', id: cid, created: ts(c.firstSeen), modified: ts(c.lastSeen),
            name: `${c.campaignId} — ${c.scamType.replace(/_/g, ' ').toLowerCase()}`,
            description: `${c.caveat} Sessions: ${c.sessions}. Peak risk: ${c.maxRisk}%.`,
            first_seen: ts(c.firstSeen), last_seen: ts(c.lastSeen),
            labels: [c.scamType.toLowerCase()],
        });
        patterns.forEach((p) => objects.push(rel(cid, 'uses', p.id, c.campaignId)));

        const ind = (kind, value, pattern, extraLabels = []) => {
            const id = sid('indicator', `${kind}:${value}`);
            if (objects.some((o) => o.id === id)) { objects.push(rel(id, 'indicates', cid, c.campaignId)); return; }
            objects.push({
                ...base, type: 'indicator', id, created: ts(c.firstSeen), modified: ts(c.lastSeen),
                name: `${kind}: ${value}`, indicator_types: ['malicious-activity'], pattern, pattern_type: 'stix',
                valid_from: ts(c.firstSeen), confidence: Math.min(95, Math.max(30, c.maxRisk)),
                labels: ['scam', kind, ...extraLabels],
            });
            objects.push(rel(id, 'indicates', cid, c.campaignId));
        };
        c.identifiers.upiIds.forEach((v) => ind('upi-id', v, `[user-account:account_type = 'upi' AND user-account:user_id = '${esc(v)}']`));
        c.identifiers.phoneNumbers.forEach((v) => ind('phone-number', v, `[user-account:account_type = 'phone' AND user-account:user_id = '${esc(v)}']`));
        c.identifiers.domains.forEach((v) => ind('domain', v, `[domain-name:value = '${esc(v)}']`));
    }

    return {
        type: 'bundle',
        id: `bundle--${uuidFor(`bundle:${Date.now()}`)}`,
        objects,
    };
}

module.exports = { buildBundle };
