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
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return { related: [], confidence: 0 };
        }

        // Get all conversation turns to extract intelligence
        const turns = await ConversationTurn.find({ sessionId });

        // Extract all identifiers from this session
        const identifiers = {
            upiIds: new Set(),
            phoneNumbers: new Set(),
            urls: new Set()
        };

        for (const turn of turns) {
            if (turn.role === 'user') {
                const intel = intelligenceExtractor.extractAll(turn.text);
                intel.upiIds.forEach(id => identifiers.upiIds.add(id));
                intel.phoneNumbers.forEach(num => identifiers.phoneNumbers.add(num));
                intel.urls.forEach(url => identifiers.urls.add(url));
            }
        }

        // Find other sessions with matching identifiers
        const relatedSessions = [];

        // Search by UPI IDs
        if (identifiers.upiIds.size > 0) {
            const upiMatches = await this._findSessionsByIdentifier(
                'upiIds',
                Array.from(identifiers.upiIds),
                sessionId
            );
            relatedSessions.push(...upiMatches);
        }

        // Search by phone numbers
        if (identifiers.phoneNumbers.size > 0) {
            const phoneMatches = await this._findSessionsByIdentifier(
                'phoneNumbers',
                Array.from(identifiers.phoneNumbers),
                sessionId
            );
            relatedSessions.push(...phoneMatches);
        }

        // Deduplicate and score matches
        const uniqueSessions = new Map();
        for (const match of relatedSessions) {
            const key = match.sessionId;
            if (!uniqueSessions.has(key)) {
                uniqueSessions.set(key, match);
            } else {
                // Increase confidence if multiple identifiers match
                const existing = uniqueSessions.get(key);
                existing.matchScore += match.matchScore;
                existing.matchedIdentifiers.push(...match.matchedIdentifiers);
            }
        }

        const related = Array.from(uniqueSessions.values())
            .sort((a, b) => b.matchScore - a.matchScore);

        return {
            sessionId,
            related,
            totalMatches: related.length,
            confidence: related.length > 0 ? Math.min(related[0].matchScore / 100, 1) : 0
        };
    }

    /**
     * Helper to find sessions by identifier type
     */
    async _findSessionsByIdentifier(identifierType, values, excludeSessionId) {
        const allTurns = await ConversationTurn.find({
            sessionId: { $ne: excludeSessionId },
            role: 'user'
        });

        const matches = [];
        const sessions = new Set();

        for (const turn of allTurns) {
            const intel = intelligenceExtractor.extractAll(turn.text);
            const extracted = intel[identifierType] || [];

            const matchesFound = values.filter(v => extracted.includes(v));

            if (matchesFound.length > 0 && !sessions.has(turn.sessionId)) {
                sessions.add(turn.sessionId);

                const session = await Session.findOne({ sessionId: turn.sessionId });
                if (session) {
                    matches.push({
                        sessionId: turn.sessionId,
                        matchScore: matchesFound.length * 50,
                        matchedIdentifiers: matchesFound.map(v => ({ type: identifierType, value: v })),
                        session: {
                            createdAt: session.createdAt,
                            scamProbability: session.maxScamProbability,
                            phase: session.highestPhase
                        }
                    });
                }
            }
        }

        return matches;
    }

    /**
     * Check if identifiers are known threats
     */
    async checkKnownThreat(identifiers) {
        const { upiIds = [], phoneNumbers = [], urls = [] } = identifiers;

        // Check ScammerIntelligence database
        const knownThreats = await ScammerIntelligence.find({
            $or: [
                { upiId: { $in: upiIds } },
                { phoneNumber: { $in: phoneNumbers } }
            ]
        });

        // Check ScammerProfile database
        const profiles = await ScammerProfile.find({
            $or: [
                { 'identifiers.upiIds': { $in: upiIds } },
                { 'identifiers.phoneNumbers': { $in: phoneNumbers } },
                { 'identifiers.urls': { $in: urls } }
            ]
        });

        return {
            isKnownThreat: knownThreats.length > 0 || profiles.length > 0,
            matches: {
                intelligence: knownThreats,
                profiles: profiles
            },
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

        // Check UPI IDs
        const sharedUpi = profile1.identifiers.upiIds.filter(id =>
            profile2.identifiers.upiIds.includes(id)
        );
        shared.push(...sharedUpi.map(id => ({ type: 'upi', value: id })));

        // Check phone numbers
        const sharedPhone = profile1.identifiers.phoneNumbers.filter(num =>
            profile2.identifiers.phoneNumbers.includes(num)
        );
        shared.push(...sharedPhone.map(num => ({ type: 'phone', value: num })));

        return shared;
    }

    /**
     * Generate detailed threat report
     */
    async generateThreatReport(profileId) {
        const profile = await ScammerProfile.findOne({ profileId });
        if (!profile) {
            return null;
        }

        // Get all sessions for this profile
        const sessionIds = profile.sessions.map(s => s.sessionId);
        const sessions = await Session.find({ sessionId: { $in: sessionIds } });

        // Get conversation samples
        const conversationSamples = [];
        for (const sessionId of sessionIds.slice(0, 5)) {
            const turns = await ConversationTurn.find({ sessionId }).limit(10);
            conversationSamples.push({ sessionId, turns });
        }

        return {
            profile: {
                id: profile.profileId,
                identifiers: profile.identifiers,
                riskScore: profile.riskScore,
                status: profile.status,
                firstSeen: profile.firstSeen,
                lastSeen: profile.lastSeen
            },
            behavioral: profile.behavioralFingerprint,
            psychological: profile.psychologicalProfile,
            intelligence: profile.intelligence,
            sessions: {
                total: profile.sessions.length,
                details: sessions.map(s => ({
                    sessionId: s.sessionId,
                    date: s.createdAt,
                    probability: s.maxScamProbability,
                    phase: s.highestPhase,
                    platform: s.platform
                }))
            },
            conversationSamples,
            recommendations: this._generateRecommendations(profile)
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
