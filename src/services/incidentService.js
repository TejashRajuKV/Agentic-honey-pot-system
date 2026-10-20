// src/services/incidentService.js
// Alert correlation. Every alert trigger is registered against an incident keyed by the scammer's primary
// identifier (falling back to the session). Only NEW incidents, and the moment an incident spreads to a
// second session, produce an outbound alert; everything else is counted and suppressed.
// State lives in MongoDB, so de-duplication survives restarts.

const Incident = require('../models/Incident');

const severityOf = (risk) => (risk >= 90 ? 'CRITICAL' : risk >= 70 ? 'HIGH' : risk >= 40 ? 'MEDIUM' : 'LOW');
const newId = () => `INC-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;

/**
 * @param {object} ev
 * @param {string} ev.sessionId
 * @param {Array<{type:string,payload:object}>} ev.triggers   alerts the detectors want to raise
 * @param {{upiIds?:string[],phoneNumbers?:string[],urls?:string[]}} ev.intelligence
 * @param {number} ev.riskScore
 * @param {string} [ev.scamType]
 * @returns {Promise<{incident:object, alerts:Array<{type:string,payload:object}>}>}
 */
async function registerEvent({ sessionId, triggers, intelligence = {}, riskScore = 0, scamType }, retryOnConflict = true) {
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 200) {
        throw new TypeError('sessionId must be a non-empty string of at most 200 characters');
    }
    if (!Array.isArray(triggers) || triggers.some((trigger) => !trigger || typeof trigger.type !== 'string' || !trigger.type.trim())) {
        throw new TypeError('triggers must be an array of typed alert objects');
    }
    if (!intelligence || typeof intelligence !== 'object' || Array.isArray(intelligence)) {
        throw new TypeError('intelligence must be an object');
    }
    const upi = intelligence.upiIds?.[0];
    const phone = intelligence.phoneNumbers?.[0];
    const key = (upi && `upi:${upi.toLowerCase()}`) || (phone && `phone:${String(phone).replace(/\D/g, '').slice(-10)}`) || `session:${sessionId}`;

    let incident = (await Incident.findOne({ key })) || (await Incident.findOne({ sessionIds: sessionId }));
    const isNew = !incident;
    if (isNew) {
        incident = new Incident({
            incidentId: newId(), key, firstEventAt: new Date(),
            // Keep raw identifiers in structured intelligence fields, not dashboard titles.
            title: `${(scamType || 'Scam').replace(/_/g, ' ').toLowerCase()} — ${upi ? 'UPI-linked activity' : phone ? 'phone-linked activity' : 'session activity'}`,
        });
    }
    if (!Array.isArray(incident.sessionIds)) incident.sessionIds = [];
    const joinedNewSession = !incident.sessionIds.includes(sessionId);
    if (joinedNewSession) {
        incident.sessionIds.push(sessionId);
        if (incident.sessionIds.length > 500) incident.sessionIds = incident.sessionIds.slice(-500);
    }

    if (!incident.identifiers || typeof incident.identifiers !== 'object') {
        incident.identifiers = { upiIds: [], phoneNumbers: [], urls: [] };
    }
    for (const field of ['upiIds', 'phoneNumbers', 'urls']) {
        if (!Array.isArray(incident.identifiers[field])) incident.identifiers[field] = [];
        for (const v of intelligence[field] || []) {
            if (typeof v === 'string' && !incident.identifiers[field].includes(v)) {
                incident.identifiers[field].push(v);
                if (incident.identifiers[field].length > 500) {
                    incident.identifiers[field] = incident.identifiers[field].slice(-500);
                }
            }
        }
    }
    for (const t of triggers) {
        incident.eventTypes.set(t.type, (incident.eventTypes.get(t.type) || 0) + 1);
        incident.eventCount += 1;
    }
    incident.maxRisk = Math.max(incident.maxRisk, riskScore);
    incident.severity = severityOf(incident.maxRisk);
    incident.scamType = scamType || incident.scamType;
    incident.lastEventAt = new Date();

    // What actually gets sent
    const alerts = [];
    if (isNew) {
        alerts.push(...triggers);
    } else if (joinedNewSession && incident.sessionIds.length === 2) {
        alerts.push({
            type: 'cross_session',
            payload: {
                sessionId, incidentId: incident.incidentId, riskScore: incident.maxRisk, scamType: incident.scamType,
                sessions: incident.sessionIds, identifiers: incident.identifiers,
            },
        });
    }
    incident.alertsSent += alerts.length;
    incident.alertsSuppressed += Math.max(0, triggers.length - alerts.length);
    try {
        await incident.save();
    } catch (error) {
        // Two workers can both observe a missing key and race to insert the first
        // incident. The unique key index prevents duplicates; re-read the winner and
        // apply this event once rather than failing the whole request.
        if (retryOnConflict && error && error.code === 11000) {
            return registerEvent(
                { sessionId, triggers, intelligence, riskScore, scamType },
                false
            );
        }
        throw error;
    }
    return { incident, alerts: alerts.map((a) => ({ ...a, payload: { ...a.payload, incidentId: incident.incidentId } })) };
}

async function listIncidents({ limit = 30, status } = {}) {
    const q = status ? { status } : {};
    const rows = await Incident.find(q).sort({ lastEventAt: -1 }).limit(limit).lean();
    return rows.map((r) => ({
        incidentId: r.incidentId, title: r.title, status: r.status, severity: r.severity, scamType: r.scamType,
        sessions: r.sessionIds.length, sessionIds: r.sessionIds, identifiers: r.identifiers,
        eventCount: r.eventCount, eventTypes: r.eventTypes instanceof Map ? Object.fromEntries(r.eventTypes) : r.eventTypes,
        alertsSent: r.alertsSent, alertsSuppressed: r.alertsSuppressed, maxRisk: r.maxRisk,
        firstEventAt: r.firstEventAt, lastEventAt: r.lastEventAt,
    }));
}

async function setStatus(incidentId, status) {
    return Incident.findOneAndUpdate({ incidentId }, { status }, { new: true });
}

module.exports = { registerEvent, listIncidents, setStatus };
