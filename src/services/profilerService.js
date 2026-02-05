// src/services/profilerService.js
const ScammerProfile = require('../models/ScammerProfile');
const Session = require('../models/Session');
const ConversationTurn = require('../models/ConversationTurn');
const intelligenceExtractor = require('../../detection/intelligenceExtractor');
const emotionDetector = require('../../detection/emotionDetector');

/**
 * Profiler Service
 * Builds behavioral and psychological profiles of scammers
 */
class ProfilerService {
    /**
     * Build comprehensive profile from session data
     */
    async buildProfile(sessionId) {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return null;
        }

        const turns = await ConversationTurn.find({ sessionId }).sort({ timestamp: 1 });
        const scammerMessages = turns.filter(t => t.role === 'user');

        if (scammerMessages.length === 0) {
            return null;
        }

        // Extract behavioral signatures
        const behavioral = await this.extractBehavioralSignatures(scammerMessages);

        // Calculate psychological profile
        const psychological = await this.calculatePsychProfile(scammerMessages, session);

        // Extract identifiers
        const identifiers = this._extractIdentifiers(scammerMessages);

        // Check if profile already exists
        let profile = await ScammerProfile.findOne({
            $or: [
                { 'identifiers.upiIds': { $in: identifiers.upiIds } },
                { 'identifiers.phoneNumbers': { $in: identifiers.phoneNumbers } }
            ]
        });

        if (!profile) {
            profile = new ScammerProfile({
                profileId: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                identifiers,
                behavioralFingerprint: behavioral,
                psychologicalProfile: psychological,
                sessions: [],
                intelligence: {
                    totalVictimAttempts: 0,
                    averageEngagementLength: 0
                }
            });
        } else {
            // Update existing profile
            profile.behavioralFingerprint = this._mergeBehavioral(
                profile.behavioralFingerprint,
                behavioral
            );
            profile.psychologicalProfile = this._mergePsychological(
                profile.psychologicalProfile,
                psychological
            );
        }

        // Add this session
        profile.sessions.push({
            sessionId,
            date: session.createdAt,
            confidence: session.maxScamProbability / 100
        });

        // Update intelligence
        profile.intelligence.totalVictimAttempts = profile.sessions.length;
        profile.intelligence.averageEngagementLength =
            (profile.intelligence.averageEngagementLength * (profile.sessions.length - 1) + turns.length) /
            profile.sessions.length;

        // Calculate risk score
        profile.riskScore = this._calculateRiskScore(profile);
        profile.confidence = Math.min(profile.sessions.length / 5, 1);

        profile.lastSeen = new Date();

        await profile.save();

        return profile;
    }

    /**
     * Extract behavioral signatures from messages
     */
    async extractBehavioralSignatures(messages) {
        const texts = messages.map(m => m.text);

        // Language patterns
        const languagePatterns = this._extractLanguagePatterns(texts);
        const signaturePhrases = this._extractSignaturePhrases(texts);

        // Communication metrics
        const avgMessageLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;

        // Temporal patterns
        const timePatterns = this._analyzeTimePatterns(messages);

        // Emotion signature
        const emotionSignature = this._analyzeEmotionProgression(messages);

        // Pressure tactics
        const pressureTactics = this._identifyPressureTactics(texts);
        const pressureVelocity = this._calculatePressureVelocity(messages);

        return {
            languagePatterns,
            signaturePhrases,
            avgMessageLength: Math.round(avgMessageLength),
            avgResponseTime: 0, // Would need timestamp analysis
            messageFrequency: messages.length,
            timePatterns,
            emotionSignature,
            pressureTactics,
            pressureVelocity
        };
    }

    /**
     * Extract language patterns
     */
    _extractLanguagePatterns(texts) {
        const patterns = [];
        const allText = texts.join(' ').toLowerCase();

        // Check for common patterns
        if (allText.includes('sir') || allText.includes('madam')) {
            patterns.push('formal_address');
        }
        if (allText.match(/\d{10}/)) {
            patterns.push('includes_phone_numbers');
        }
        if (allText.includes('@')) {
            patterns.push('includes_upi_or_email');
        }
        if (allText.match(/urgent|immediate|asap|quickly/i)) {
            patterns.push('urgency_language');
        }
        if (allText.match(/bank|account|kyc|rbi/i)) {
            patterns.push('banking_terminology');
        }
        if (allText.match(/otp|pin|password|cvv/i)) {
            patterns.push('credential_requests');
        }

        return patterns;
    }

    /**
     * Extract signature phrases (most common phrases)
     */
    _extractSignaturePhrases(texts) {
        const phrases = new Map();

        for (const text of texts) {
            // Extract 2-4 word phrases
            const words = text.toLowerCase().split(/\s+/);
            for (let i = 0; i < words.length - 1; i++) {
                for (let len = 2; len <= 4 && i + len <= words.length; len++) {
                    const phrase = words.slice(i, i + len).join(' ');
                    if (phrase.length > 10) { // Minimum phrase length
                        phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
                    }
                }
            }
        }

        // Return top 10 phrases
        return Array.from(phrases.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([phrase]) => phrase);
    }

    /**
     * Analyze temporal patterns
     */
    _analyzeTimePatterns(messages) {
        const hours = messages.map(m => new Date(m.timestamp).getHours());
        const days = messages.map(m => new Date(m.timestamp).getDay());

        return {
            activeHours: [...new Set(hours)].sort((a, b) => a - b),
            activeDays: [...new Set(days)].sort((a, b) => a - b),
            timezone: 'unknown'
        };
    }

    /**
     * Analyze emotion progression
     */
    _analyzeEmotionProgression(messages) {
        const emotions = messages.map(m => {
            const detected = emotionDetector.detectEmotion(m.text);
            return detected.emotion;
        });

        const emotionCounts = {};
        emotions.forEach(e => emotionCounts[e] = (emotionCounts[e] || 0) + 1);

        const primaryEmotion = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

        return {
            primaryEmotion,
            emotionSequence: emotions,
            intensityProgression: emotions.map((_, i) => i / emotions.length) // Simplified
        };
    }

    /**
     * Identify pressure tactics used
     */
    _identifyPressureTactics(texts) {
        const tactics = [];
        const allText = texts.join(' ').toLowerCase();

        if (allText.match(/urgent|hurry|immediate|quickly|fast/i)) {
            tactics.push('time_pressure');
        }
        if (allText.match(/block|suspend|close|terminate|freeze/i)) {
            tactics.push('threat_of_loss');
        }
        if (allText.match(/officer|bank|rbi|government|police/i)) {
            tactics.push('authority_impersonation');
        }
        if (allText.match(/prize|won|winner|congratulations|reward/i)) {
            tactics.push('reward_promise');
        }
        if (allText.match(/verify|confirm|update|validate|authenticate/i)) {
            tactics.push('action_request');
        }
        if (allText.match(/must|should|need to|have to/i)) {
            tactics.push('obligation_language');
        }

        return [...new Set(tactics)];
    }

    /**
     * Calculate pressure velocity
     */
    _calculatePressureVelocity(messages) {
        if (messages.length === 0) return 'slow';

        const urgentKeywords = ['urgent', 'immediate', 'now', 'quickly', 'asap'];
        const credentialRequests = ['otp', 'pin', 'password', 'cvv'];

        let urgencyScore = 0;

        for (let i = 0; i < messages.length; i++) {
            const text = messages[i].text.toLowerCase();

            // Check for urgent keywords
            if (urgentKeywords.some(k => text.includes(k))) {
                urgencyScore += (5 - i) * 10; // Earlier = higher score
            }

            // Check for credential requests
            if (credentialRequests.some(k => text.includes(k))) {
                urgencyScore += (5 - i) * 20;
            }
        }

        if (urgencyScore > 50) return 'fast';
        if (urgencyScore > 20) return 'medium';
        return 'slow';
    }

    /**
     * Calculate psychological profile
     */
    async calculatePsychProfile(messages, session) {
        const texts = messages.map(m => m.text);
        const allText = texts.join(' ').toLowerCase();

        // Determine primary tactic
        const tacticScores = {
            authority: (allText.match(/officer|bank|rbi|government/gi) || []).length,
            urgency: (allText.match(/urgent|immediate|quickly/gi) || []).length,
            fear: (allText.match(/block|suspend|legal action|arrest/gi) || []).length,
            greed: (allText.match(/prize|won|reward|cashback/gi) || []).length,
            sympathy: (allText.match(/help|please|need|emergency/gi) || []).length,
            trust: (allText.match(/verify|confirm|secure|protect/gi) || []).length
        };

        const primaryTactic = Object.entries(tacticScores)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'urgency';

        // Assess sophistication
        const sophistication = this._assessSophistication(texts, session);

        // Calculate adaptability (how well they respond to pushback)
        const adaptability = 0.5; // Would need more conversation analysis

        // Calculate persistence
        const persistenceScore = Math.min(messages.length / 10, 1);

        // Identify manipulation techniques
        const manipulationTechniques = this._identifyManipulationTechniques(texts);

        return {
            primaryTactic,
            sophistication,
            adaptability,
            persistenceScore,
            manipulationTechniques
        };
    }

    /**
     * Assess sophistication level
     */
    _assessSophistication(texts, session) {
        let score = 0;

        // Grammar quality
        const hasGoodGrammar = texts.some(t =>
            t.includes('.') && t[0] === t[0].toUpperCase()
        );
        if (hasGoodGrammar) score++;

        // Personalization
        if (texts.some(t => t.toLowerCase().includes('sir') || t.toLowerCase().includes('madam'))) {
            score++;
        }

        // Gradual escalation
        if (session.engagementPhase === 'final' || session.engagementPhase === 'late') {
            score++;
        }

        // Professional terminology
        const professionalTerms = ['verify', 'authenticate', 'compliance', 'regulation', 'procedure'];
        if (texts.some(t => professionalTerms.some(term => t.toLowerCase().includes(term)))) {
            score++;
        }

        if (score >= 3) return 'high';
        if (score >= 2) return 'medium';
        return 'low';
    }

    /**
     * Assess sophistication score
     */
    scoreSophistication(profile) {
        const { psychologicalProfile, behavioralFingerprint, intelligence } = profile;

        let score = 0;

        // Sophistication level
        const sophMap = { low: 1, medium: 2, high: 3, expert: 4 };
        score += (sophMap[psychologicalProfile.sophistication] || 1) * 25;

        // Adaptability
        score += psychologicalProfile.adaptability * 25;

        // Number of tactics used
        score += Math.min(behavioralFingerprint.pressureTactics.length / 5, 1) * 25;

        // Success rate
        score += (intelligence.successRate || 0) * 25;

        return Math.round(score);
    }

    /**
     * Identify manipulation techniques
     */
    _identifyManipulationTechniques(texts) {
        const techniques = [];
        const allText = texts.join(' ').toLowerCase();

        if (allText.match(/click|link|download/i)) {
            techniques.push('phishing_links');
        }
        if (allText.match(/share|send|provide|give/i)) {
            techniques.push('information_elicitation');
        }
        if (allText.match(/limited time|expire|deadline/i)) {
            techniques.push('scarcity_principle');
        }
        if (allText.match(/everyone|many people|thousands/i)) {
            techniques.push('social_proof');
        }
        if (allText.match(/official|authorized|certified/i)) {
            techniques.push('authority_appeal');
        }

        return techniques;
    }

    /**
     * Merge behavioral data from multiple sessions
     */
    _mergeBehavioral(existing, newData) {
        return {
            languagePatterns: [...new Set([...existing.languagePatterns, ...newData.languagePatterns])],
            signaturePhrases: [...new Set([...existing.signaturePhrases, ...newData.signaturePhrases])].slice(0, 10),
            avgMessageLength: Math.round((existing.avgMessageLength + newData.avgMessageLength) / 2),
            avgResponseTime: existing.avgResponseTime,
            messageFrequency: existing.messageFrequency + newData.messageFrequency,
            timePatterns: {
                activeHours: [...new Set([...existing.timePatterns.activeHours, ...newData.timePatterns.activeHours])],
                activeDays: [...new Set([...existing.timePatterns.activeDays, ...newData.timePatterns.activeDays])],
                timezone: existing.timePatterns.timezone
            },
            emotionSignature: newData.emotionSignature, // Use latest
            pressureTactics: [...new Set([...existing.pressureTactics, ...newData.pressureTactics])],
            pressureVelocity: newData.pressureVelocity
        };
    }

    /**
     * Merge psychological data
     */
    _mergePsychological(existing, newData) {
        return {
            primaryTactic: existing.primaryTactic, // Keep first identified
            sophistication: this._maxSophistication(existing.sophistication, newData.sophistication),
            adaptability: (existing.adaptability + newData.adaptability) / 2,
            persistenceScore: Math.max(existing.persistenceScore, newData.persistenceScore),
            manipulationTechniques: [...new Set([...existing.manipulationTechniques, ...newData.manipulationTechniques])]
        };
    }

    /**
     * Get maximum sophistication level
     */
    _maxSophistication(a, b) {
        const levels = { low: 1, medium: 2, high: 3, expert: 4 };
        return levels[a] > levels[b] ? a : b;
    }

    /**
     * Extract identifiers from messages
     */
    _extractIdentifiers(messages) {
        const identifiers = {
            upiIds: [],
            phoneNumbers: [],
            urls: [],
            emailAddresses: []
        };

        for (const message of messages) {
            const intel = intelligenceExtractor.extractAll(message.text);
            identifiers.upiIds.push(...intel.upiIds);
            identifiers.phoneNumbers.push(...intel.phoneNumbers);
            identifiers.urls.push(...intel.urls);
        }

        // Deduplicate
        identifiers.upiIds = [...new Set(identifiers.upiIds)];
        identifiers.phoneNumbers = [...new Set(identifiers.phoneNumbers)];
        identifiers.urls = [...new Set(identifiers.urls)];

        return identifiers;
    }

    /**
     * Calculate overall risk score
     */
    _calculateRiskScore(profile) {
        let score = 0;

        // Session count contribution (more sessions = higher risk)
        score += Math.min(profile.sessions.length * 5, 30);

        // Psychological factors
        const tacticRisk = {
            fear: 20,
            authority: 15,
            urgency: 10,
            greed: 10,
            sympathy: 5,
            trust: 5
        };
        score += tacticRisk[profile.psychologicalProfile.primaryTactic] || 10;

        // Sophistication
        const sophRisk = { low: 5, medium: 15, high: 25, expert: 35 };
        score += sophRisk[profile.psychologicalProfile.sophistication] || 10;

        // Behavioral patterns
        score += Math.min(profile.behavioralFingerprint.pressureTactics.length * 5, 20);

        // Intelligence metrics
        if (profile.intelligence.totalVictimAttempts > 10) {
            score += 15;
        } else if (profile.intelligence.totalVictimAttempts > 5) {
            score += 10;
        }

        return Math.min(Math.round(score), 100);
    }

    /**
     * Match profiles to find similar scammers
     */
    async matchProfiles(targetProfileId, limit = 10) {
        const targetProfile = await ScammerProfile.findOne({ profileId: targetProfileId });
        if (!targetProfile) {
            return [];
        }

        const allProfiles = await ScammerProfile.find({
            profileId: { $ne: targetProfileId },
            status: 'active'
        });

        const matches = allProfiles.map(profile => ({
            profile,
            similarity: this._calculateSimilarity(targetProfile, profile)
        }))
            .filter(m => m.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);

        return matches.map(m => ({
            profileId: m.profile.profileId,
            similarity: m.similarity,
            sharedTraits: this._identifySharedTraits(targetProfile, m.profile)
        }));
    }

    /**
     * Calculate similarity between two profiles
     */
    _calculateSimilarity(profile1, profile2) {
        let score = 0;
        let factors = 0;

        // Primary tactic
        if (profile1.psychologicalProfile.primaryTactic === profile2.psychologicalProfile.primaryTactic) {
            score += 0.3;
        }
        factors++;

        // Sophistication
        if (profile1.psychologicalProfile.sophistication === profile2.psychologicalProfile.sophistication) {
            score += 0.2;
        }
        factors++;

        // Shared pressure tactics
        const sharedTactics = profile1.behavioralFingerprint.pressureTactics.filter(t =>
            profile2.behavioralFingerprint.pressureTactics.includes(t)
        );
        score += (sharedTactics.length / Math.max(
            profile1.behavioralFingerprint.pressureTactics.length,
            profile2.behavioralFingerprint.pressureTactics.length,
            1
        )) * 0.3;
        factors++;

        // Shared language patterns
        const sharedPatterns = profile1.behavioralFingerprint.languagePatterns.filter(p =>
            profile2.behavioralFingerprint.languagePatterns.includes(p)
        );
        score += (sharedPatterns.length / Math.max(
            profile1.behavioralFingerprint.languagePatterns.length,
            profile2.behavioralFingerprint.languagePatterns.length,
            1
        )) * 0.2;
        factors++;

        return score / factors;
    }

    /**
     * Identify shared traits between profiles
     */
    _identifySharedTraits(profile1, profile2) {
        const traits = [];

        if (profile1.psychologicalProfile.primaryTactic === profile2.psychologicalProfile.primaryTactic) {
            traits.push(`Same primary tactic: ${profile1.psychologicalProfile.primaryTactic}`);
        }

        const sharedTactics = profile1.behavioralFingerprint.pressureTactics.filter(t =>
            profile2.behavioralFingerprint.pressureTactics.includes(t)
        );
        if (sharedTactics.length > 0) {
            traits.push(`Shared tactics: ${sharedTactics.join(', ')}`);
        }

        return traits;
    }
}

module.exports = new ProfilerService();
