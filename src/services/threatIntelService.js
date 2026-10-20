// src/services/threatIntelService.js
const Session = require('../models/Session');
const ConversationTurn = require('../models/ConversationTurn');
const ScammerIntelligence = require('../models/ScammerIntelligence');
const ScammerProfile = require('../models/ScammerProfile');
const intelligenceExtractor = require('../../detection/intelligenceExtractor');

/**
 * Threat Intelligence Service
 * Cross-session correlation and threat actor identification
 */
class ThreatIntelligenceService {
    /**
     * Correlate sessions to find related scam attempts
     */
    async correlateSessions(sessionId) {
        if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 256) {
            return { related: [], totalMatches: 0, confidence: 0 };
        }
        sessionId = sessionId.trim();
        const session = await Session.findOne({ sessionId }).select('sessionId').lean();
        if (!session) {
            return { related: [], totalMatches: 0, confidence: 0 };
        }

        // Extract evidence from the source session once, then scan the bounded
        // recent-turn window once for all indicator families. Previously each
        // family triggered a separate 5,000-turn database read and re-extraction.
        const sourceTurns = await ConversationTurn.find({ sessionId, role: 'user' })
            .select('text')
            .sort({ turnIndex: -1, _id: -1 })
            .limit(2000)
            .lean();
        const identifiers = { upiIds: new Set(), phoneNumbers: new Set(), urls: new Set() };
        for (const turn of sourceTurns) {
            if (typeof turn.text !== 'string') continue;
            const intel = intelligenceExtractor.extractAll(turn.text);
            for (const type of Object.keys(identifiers)) {
                const values = Array.isArray(intel?.[type]) ? intel[type] : [];
                for (const value of values) {
                    if (typeof value === 'string' && value.trim() && value.length <= 2048) {
                        identifiers[type].add(value.trim());
                    }
                }
            }
        }

        if (![...identifiers.upiIds, ...identifiers.phoneNumbers, ...identifiers.urls].length) {
            return { sessionId, related: [], totalMatches: 0, confidence: 0 };
        }

        const allTurns = await ConversationTurn.find({
            sessionId: { $ne: sessionId },
            role: 'user'
        })
            .select('sessionId text timestamp')
            .sort({ timestamp: -1, _id: -1 })
            .limit(5000)
            .lean();

        // Keep one evidence set per candidate session. An identifier appearing
        // repeatedly across turns contributes only once to the correlation score.
        const matchesBySession = new Map();
        for (const turn of allTurns) {
            if (typeof turn.sessionId !== 'string' || !turn.sessionId ||
                typeof turn.text !== 'string') continue;
            const intel = intelligenceExtractor.extractAll(turn.text);
            const matches = [];
            for (const type of Object.keys(identifiers)) {
                const sourceValues = identifiers[type];
                if (!sourceValues.size) continue;
                const extracted = Array.isArray(intel?.[type]) ? intel[type] : [];
                for (const value of extracted) {
                    if (typeof value === 'string' && sourceValues.has(value)) {
                        matches.push({ type, value });
                    }
                }
            }
            if (!matches.length) continue;

            if (!matchesBySession.has(turn.sessionId)) matchesBySession.set(turn.sessionId, new Map());
            const evidence = matchesBySession.get(turn.sessionId);
            for (const item of matches) evidence.set(`${item.type}:${item.value}`, item);
        }

        // Candidate ordering follows the recent-turn scan; cap IDs before the
        // single batched session lookup to bound memory and database work.
        const candidateIds = [...matchesBySession.keys()].slice(0, 200);
        if (!candidateIds.length) {
            return { sessionId, related: [], totalMatches: 0, confidence: 0 };
        }
        const sessions = await Session.find({ sessionId: { $in: candidateIds } })
            .select('sessionId createdAt maxScamProbability highestPhase')
            .lean();
        const sessionById = new Map(sessions.map((item) => [item.sessionId, item]));

        const related = candidateIds.map((candidateId) => {
            const candidate = sessionById.get(candidateId);
            if (!candidate) return null;
            const matchedIdentifiers = [...matchesBySession.get(candidateId).values()];
            return {
                sessionId: candidateId,
                matchScore: matchedIdentifiers.length * 50,
                matchedIdentifiers,
                session: {
                    createdAt: candidate.createdAt,
                    scamProbability: candidate.maxScamProbability,
                    phase: candidate.highestPhase
                }
            };
        }).filter(Boolean)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 100);

        return {
            sessionId,
            related,
            totalMatches: related.length,
            confidence: related.length > 0 ? Math.min(related[0].matchScore / 100, 1) : 0
        };
    }

    /**
     * Check if identifiers are known threats
     */
    async checkKnownThreat(identifiers = {}) {
        const cleanValues = (values, maxLength) => Array.isArray(values)
            ? [...new Set(values
                .filter((value) => typeof value === 'string' && value.trim() && value.length <= maxLength)
                .map((value) => value.trim()))].slice(0, 100)
            : [];
        const upiIds = cleanValues(identifiers?.upiIds, 256);
        const phoneNumbers = cleanValues(identifiers?.phoneNumbers, 64);
        const urls = cleanValues(identifiers?.urls, 2048);

        // Avoid broad queries when callers provide no usable indicators.
        if (upiIds.length === 0 && phoneNumbers.length === 0 && urls.length === 0) {
            return {
                isKnownThreat: false,
                matches: { intelligence: [], profiles: [] },
                riskLevel: 'LOW',
                recommendedAction: 'NORMAL'
            };
        }

        const intelligenceClauses = [];
        if (upiIds.length) intelligenceClauses.push({ upiId: { $in: upiIds } });
        if (phoneNumbers.length) intelligenceClauses.push({ phoneNumber: { $in: phoneNumbers } });
        const profileClauses = [];
        if (upiIds.length) profileClauses.push({ 'identifiers.upiIds': { $in: upiIds } });
        if (phoneNumbers.length) profileClauses.push({ 'identifiers.phoneNumbers': { $in: phoneNumbers } });
        if (urls.length) profileClauses.push({ 'identifiers.urls': { $in: urls } });

        // Return only fields needed for analyst triage, and cap result counts so a
        // common or deliberately repeated indicator cannot dump the full database.
        const [knownThreats, profiles] = await Promise.all([
            intelligenceClauses.length
                ? ScammerIntelligence.find({ $or: intelligenceClauses })
                    .select('upiId phoneNumber sessionCount riskLevel scamTypes averageConfidence isBlacklisted firstSeenAt lastSeenAt')
                    .sort({ sessionCount: -1, lastSeenAt: -1 })
                    .limit(50)
                    .lean()
                : [],
            profileClauses.length
                ? ScammerProfile.find({ $or: profileClauses })
                    .select('profileId identifiers riskScore status confidence firstSeen lastSeen')
                    .sort({ riskScore: -1, lastSeen: -1 })
                    .limit(50)
                    .lean()
                : []
        ]);

        return {
            isKnownThreat: knownThreats.length > 0 || profiles.length > 0,
            matches: { intelligence: knownThreats, profiles },
            riskLevel: this._assessRiskLevel(knownThreats, profiles),
            recommendedAction: this._getRecommendedAction(knownThreats, profiles)
        };
    }

    /**
     * Assess overall risk level based on known threats
     */
    _assessRiskLevel(intelligence, profiles) {
        if (profiles.some(p => p.status === 'blacklisted')) {
            return 'CRITICAL';
        }

        if (profiles.some(p => p.riskScore >= 80)) {
            return 'HIGH';
        }

        if (intelligence.some(i => i.sessionCount >= 5)) {
            return 'HIGH';
        }

        if (profiles.length > 0 || intelligence.length > 0) {
            return 'MEDIUM';
        }

        return 'LOW';
    }

    /**
     * Get recommended action based on threat level
     */
    _getRecommendedAction(intelligence, profiles) {
        if (profiles.some(p => p.status === 'blacklisted')) {
            return 'TERMINATE_IMMEDIATELY';
        }

        if (profiles.some(p => p.riskScore >= 80)) {
            return 'DEFENSIVE_MODE';
        }

        if (intelligence.length > 0) {
            return 'ELEVATED_MONITORING';
        }

        return 'NORMAL';
    }

    /**
     * Update threat profile with new session data
     */
    async updateThreatProfile(sessionId, intelligence) {
        const { upiIds, phoneNumbers, urls } = intelligence;

        if (upiIds.length === 0 && phoneNumbers.length === 0) {
            return null; // No identifiable intelligence
        }

        // Find existing profile or create new one
        let profile = await ScammerProfile.findOne({
            $or: [
                { 'identifiers.upiIds': { $in: upiIds } },
                { 'identifiers.phoneNumbers': { $in: phoneNumbers } }
            ]
        });

        if (!profile) {
            // Create new profile
            profile = new ScammerProfile({
                profileId: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                identifiers: {
                    upiIds,
                    phoneNumbers,
                    urls
                },
                sessions: [],
                intelligence: {
                    totalVictimAttempts: 0,
                    successRate: 0,
                    averageEngagementLength: 0
                }
            });
        }

        // Update identifiers (merge new ones)
        profile.identifiers.upiIds = [...new Set([...profile.identifiers.upiIds, ...upiIds])];
        profile.identifiers.phoneNumbers = [...new Set([...profile.identifiers.phoneNumbers, ...phoneNumbers])];
        profile.identifiers.urls = [...new Set([...profile.identifiers.urls, ...urls])];

        // Add session to profile
        const session = await Session.findOne({ sessionId });
        if (session) {
            profile.sessions.push({
                sessionId,
                date: session.createdAt,
                confidence: session.maxScamProbability / 100
            });

            profile.intelligence.totalVictimAttempts++;
            profile.lastSeen = new Date();
        }

        await profile.save();

        return profile;
    }

    /**
     * Get threat network graph (relationships between scammers)
     */
    async getThreatNetwork(limit = 50) {
        const profiles = await ScammerProfile.find({ status: 'active' })
            .sort({ riskScore: -1 })
            .limit(limit);

        // Build network graph
        const nodes = profiles.map(p => ({
            id: p.profileId,
            label: `Scammer ${p.profileId.split('_')[1]}`,
            riskScore: p.riskScore,
            sessionCount: p.sessions.length,
            tactics: p.psychologicalProfile.primaryTactic
        }));

        // Find edges (shared identifiers)
        const edges = [];
        for (let i = 0; i < profiles.length; i++) {
            for (let j = i + 1; j < profiles.length; j++) {
                const shared = this._findSharedIdentifiers(profiles[i], profiles[j]);
                if (shared.length > 0) {
                    edges.push({
                        source: profiles[i].profileId,
                        target: profiles[j].profileId,
                        weight: shared.length,
                        sharedIdentifiers: shared
                    });
                }
            }
        }

        return {
            nodes,
            edges,
            statistics: {
                totalProfiles: profiles.length,
                totalConnections: edges.length,
                avgConnectionsPerProfile: edges.length > 0 ? (edges.length * 2 / profiles.length).toFixed(1) : 0
            }
        };
    }

    /**
     * Find shared identifiers between two profiles
     */
    _findSharedIdentifiers(profile1, profile2) {
        const shared = [];

        const identifiers1 = profile1.identifiers || {};
        const identifiers2 = profile2.identifiers || {};

        // Compare each supported indicator family independently. Missing arrays
        // are treated as empty for older profiles created before a field existed.
        const sharedUpi = (identifiers1.upiIds || []).filter(id =>
            (identifiers2.upiIds || []).includes(id)
        );
        shared.push(...sharedUpi.map(id => ({ type: 'upi', value: id })));

        const sharedPhone = (identifiers1.phoneNumbers || []).filter(num =>
            (identifiers2.phoneNumbers || []).includes(num)
        );
        shared.push(...sharedPhone.map(num => ({ type: 'phone', value: num })));

        // URLs are collected by the pipeline too; include them in correlation so
        // shared domains and phishing links are not silently omitted from the graph.
        const sharedUrls = (identifiers1.urls || []).filter(url =>
            (identifiers2.urls || []).includes(url)
        );
        shared.push(...sharedUrls.map(url => ({ type: 'url', value: url })));

        return shared;
    }

    /**
     * Generate detailed threat report
     */
    async generateThreatReport(profileId) {
        if (typeof profileId !== 'string' || !profileId.trim() || profileId.length > 256) {
            return null;
        }
        const profile = await ScammerProfile.findOne({ profileId: profileId.trim() }).lean();
        if (!profile) return null;

        // Older profile documents may contain malformed or unbounded session arrays.
        // Keep the report useful without turning one request into an unbounded export.
        const sessionIds = [...new Set(
            (Array.isArray(profile.sessions) ? profile.sessions : [])
                .map((entry) => entry && entry.sessionId)
                .filter((id) => typeof id === 'string' && id.trim() && id.length <= 256)
        )].slice(-500);
        const [sessions, sampleTurns] = await Promise.all([
            sessionIds.length
                ? Session.find({ sessionId: { $in: sessionIds } })
                    .select('sessionId createdAt maxScamProbability highestPhase platform')
                    .lean()
                : [],
            sessionIds.length
                ? ConversationTurn.find({ sessionId: { $in: sessionIds.slice(-5) } })
                    .select('sessionId role text timestamp turnIndex')
                    .sort({ timestamp: -1, _id: -1 })
                    .limit(50)
                    .lean()
                : []
        ]);

        const turnsBySession = new Map();
        for (const turn of sampleTurns) {
            if (!turn || typeof turn.sessionId !== 'string') continue;
            if (!turnsBySession.has(turn.sessionId)) turnsBySession.set(turn.sessionId, []);
            const group = turnsBySession.get(turn.sessionId);
            if (group.length < 10) {
                group.push({
                    role: turn.role,
                    text: typeof turn.text === 'string' ? turn.text.slice(0, 1500) : '',
                    timestamp: turn.timestamp,
                    turnIndex: turn.turnIndex
                });
            }
        }
        const conversationSamples = [...turnsBySession.entries()].map(([id, turns]) => ({
            sessionId: id,
            turns: turns.reverse()
        }));
        const sessionById = new Map(sessions.map((session) => [session.sessionId, session]));
        const sessionDetails = sessionIds
            .map((id) => sessionById.get(id))
            .filter(Boolean)
            .map((session) => ({
                sessionId: session.sessionId,
                date: session.createdAt,
                probability: session.maxScamProbability,
                phase: session.highestPhase,
                platform: session.platform
            }));

        const identifiers = profile.identifiers && typeof profile.identifiers === 'object'
            ? Object.fromEntries(['upiIds', 'phoneNumbers', 'urls', 'emailAddresses'].map((field) => [
                field,
                [...new Set((Array.isArray(profile.identifiers[field]) ? profile.identifiers[field] : [])
                    .filter((value) => typeof value === 'string' && value.length <= 2048))]
                    .slice(-500)
            ]))
            : {};

        return {
            profile: {
                id: profile.profileId,
                identifiers,
                riskScore: profile.riskScore,
                status: profile.status,
                firstSeen: profile.firstSeen,
                lastSeen: profile.lastSeen
            },
            behavioral: profile.behavioralFingerprint || {},
            psychological: profile.psychologicalProfile || {},
            intelligence: profile.intelligence || {},
            sessions: {
                total: Array.isArray(profile.sessions) ? profile.sessions.length : 0,
                details: sessionDetails
            },
            conversationSamples,
            recommendations: this._generateRecommendations({
                ...profile,
                intelligence: profile.intelligence || {},
                psychologicalProfile: profile.psychologicalProfile || {}
            })
        };
    }

    /**
     * Generate recommendations based on profile
     */
    _generateRecommendations(profile) {
        const recommendations = [];

        if (profile.riskScore >= 80) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Immediate blacklisting recommended',
                reason: 'Critical risk score'
            });
        }

        if (profile.intelligence.totalVictimAttempts >= 10) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Report to law enforcement',
                reason: 'High volume of victim targeting'
            });
        }

        if (profile.psychologicalProfile.sophistication === 'expert') {
            recommendations.push({
                priority: 'HIGH',
                action: 'Enhanced monitoring and analysis',
                reason: 'Highly sophisticated threat actor'
            });
        }

        return recommendations;
    }
}

module.exports = new ThreatIntelligenceService();
