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
    async buildProfile(sessionId, retryAttempt = 0) {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return null;
        }

        // Profiles are rebuilt from persisted history; cap the working set so a
        // long-running or adversarial session cannot make profiling unbounded.
        // Fetch the newest turns efficiently, then restore chronological order for
        // temporal and emotion-sequence calculations.
        const turns = (await ConversationTurn.find({ sessionId })
            .sort({ turnIndex: -1, _id: -1 })
            .limit(2000)
            .lean()).reverse();
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
        const identityClauses = [];
        const allowedIdentifierFields = new Set(['upiIds', 'phoneNumbers', 'emails', 'urls']);
        for (const [field, values] of Object.entries(identifiers)) {
            if (allowedIdentifierFields.has(field) && Array.isArray(values) && values.length > 0) {
                // Bound the database predicate even if an extractor returns malformed
                // or unexpectedly large output.
                const candidates = [...new Set(values
                    .filter((value) => typeof value === 'string' && value.trim() && value.length <= 256)
                    .map((value) => value.trim()))].slice(0, 100);
                if (candidates.length) identityClauses.push({ [`identifiers.${field}`]: { $in: candidates } });
            }
        }
        let profile = identityClauses.length
            ? await ScammerProfile.findOne({ $or: identityClauses })
            : null;

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
            // buildProfile can run repeatedly as each turn arrives. The session's
            // messages are a complete snapshot, not a delta: merging the snapshot
            // every time inflated messageFrequency and repeatedly reweighted the
            // psychological profile. Aggregate behavioral metrics only when this
            // session is first associated with the profile.
            const alreadyTrackedSession = Array.isArray(profile.sessions) &&
                profile.sessions.some((entry) => entry && entry.sessionId === sessionId);
            if (!alreadyTrackedSession) {
                profile.behavioralFingerprint = this._mergeBehavioral(
                    profile.behavioralFingerprint,
                    behavioral
                );
                profile.psychologicalProfile = this._mergePsychological(
                    profile.psychologicalProfile,
                    psychological
                );
            }

            // Identifiers can legitimately appear in later turns of an already
            // tracked session, so always merge these independently of session count.
            if (!profile.identifiers || typeof profile.identifiers !== 'object') profile.identifiers = {};
            for (const [field, values] of Object.entries(identifiers)) {
                const previous = Array.isArray(profile.identifiers[field]) ? profile.identifiers[field] : [];
                profile.identifiers[field] = [...new Set([...previous, ...values])].slice(-500);
            }
        }

        // A profile may be rebuilt after every scammer turn. Count a session only
        // once; otherwise one long conversation inflates victim-attempt metrics and
        // can make a single actor appear to be a multi-session campaign.
        if (!profile.intelligence || typeof profile.intelligence !== 'object') {
            profile.intelligence = { totalVictimAttempts: 0, averageEngagementLength: 0 };
        }
        if (!Array.isArray(profile.sessions)) profile.sessions = [];
        const existingSessionIndex = profile.sessions.findIndex((entry) => entry.sessionId === sessionId);
        const isNewSession = existingSessionIndex < 0;
        const previousAttempts = Number.isFinite(profile.intelligence.totalVictimAttempts)
            ? profile.intelligence.totalVictimAttempts
            : profile.sessions.length;

        const sessionEntry = {
            sessionId,
            date: session.createdAt,
            confidence: (Number(session.maxScamProbability) || 0) / 100
        };
        if (isNewSession) {
            profile.sessions.push(sessionEntry);
            profile.intelligence.totalVictimAttempts = previousAttempts + 1;
            profile.intelligence.averageEngagementLength =
                ((Number(profile.intelligence.averageEngagementLength) || 0) * previousAttempts + turns.length) /
                Math.max(profile.intelligence.totalVictimAttempts, 1);
        } else {
            // Refresh current session evidence without treating another turn as a new attempt.
            profile.sessions[existingSessionIndex] = sessionEntry;
        }

        // Bound stored session references while keeping the cumulative attempt counter.
        if (profile.sessions.length > 500) profile.sessions = profile.sessions.slice(-500);

        // Normalize older/partially populated documents before risk calculations.
        if (!profile.behavioralFingerprint || typeof profile.behavioralFingerprint !== 'object') {
            profile.behavioralFingerprint = behavioral;
        }
        if (!profile.psychologicalProfile || typeof profile.psychologicalProfile !== 'object') {
            profile.psychologicalProfile = psychological;
        }
        if (!Array.isArray(profile.behavioralFingerprint.pressureTactics)) {
            profile.behavioralFingerprint.pressureTactics = [];
        }
        if (typeof profile.psychologicalProfile.primaryTactic !== 'string') {
            profile.psychologicalProfile.primaryTactic = 'urgency';
        }
        if (typeof profile.psychologicalProfile.sophistication !== 'string') {
            profile.psychologicalProfile.sophistication = 'low';
        }

        // Calculate risk score from cumulative distinct-session metrics.
        profile.riskScore = this._calculateRiskScore(profile);
        profile.confidence = Math.min(profile.intelligence.totalVictimAttempts / 5, 1);

        profile.lastSeen = new Date();

        try {
            await profile.save();
        } catch (error) {
            // Profile builds may overlap when multiple turns arrive close together.
            // Optimistic concurrency prevents a stale document from silently
            // overwriting a newer profile; re-read and rebuild from persisted turns
            // a small, bounded number of times when that happens.
            const retryableWriteConflict = error?.name === 'VersionError' || error?.code === 11000;
            if (retryableWriteConflict && retryAttempt < 2) {
                return this.buildProfile(sessionId, retryAttempt + 1);
            }
            throw error;
        }

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
        const validDates = messages
            .map((message) => new Date(message.timestamp))
            .filter((date) => Number.isFinite(date.getTime()));
        const hours = validDates.map((date) => date.getHours());
        const days = validDates.map((date) => date.getDay());

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
            const text = typeof messages[i].text === 'string' ? messages[i].text.toLowerCase() : '';
            // Use a non-negative recency weight: long conversations can exceed five
            // turns, and the old (5 - i) expression made later messages subtract
            // from the pressure score, potentially reversing the signal.
            const recencyWeight = Math.max(1, 5 - i);

            if (urgentKeywords.some(k => text.includes(k))) {
                urgencyScore += recencyWeight * 10;
            }

            if (credentialRequests.some(k => text.includes(k))) {
                urgencyScore += recencyWeight * 20;
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
    _mergeBehavioral(existing = {}, newData = {}) {
        // Older profile documents may predate nested fields introduced by later
        // schema versions. Normalize every collection before merging so one legacy
        // record cannot prevent profile refreshes for an otherwise valid session.
        const previous = existing && typeof existing === 'object' ? existing : {};
        const incoming = newData && typeof newData === 'object' ? newData : {};
        const previousTime = previous.timePatterns && typeof previous.timePatterns === 'object'
            ? previous.timePatterns
            : {};
        const incomingTime = incoming.timePatterns && typeof incoming.timePatterns === 'object'
            ? incoming.timePatterns
            : {};
        const uniqueStrings = (a, b, limit = 500) => [...new Set([
            ...(Array.isArray(a) ? a : []),
            ...(Array.isArray(b) ? b : [])
        ].filter((value) => typeof value === 'string' && value.trim()))].slice(-limit);
        const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

        return {
            languagePatterns: uniqueStrings(previous.languagePatterns, incoming.languagePatterns),
            signaturePhrases: uniqueStrings(previous.signaturePhrases, incoming.signaturePhrases, 10),
            avgMessageLength: Math.round((numeric(previous.avgMessageLength) + numeric(incoming.avgMessageLength)) / 2),
            avgResponseTime: numeric(previous.avgResponseTime),
            messageFrequency: numeric(previous.messageFrequency) + numeric(incoming.messageFrequency),
            timePatterns: {
                activeHours: [...new Set([
                    ...(Array.isArray(previousTime.activeHours) ? previousTime.activeHours : []),
                    ...(Array.isArray(incomingTime.activeHours) ? incomingTime.activeHours : [])
                ].filter((value) => Number.isInteger(value) && value >= 0 && value <= 23))].sort((a, b) => a - b),
                activeDays: [...new Set([
                    ...(Array.isArray(previousTime.activeDays) ? previousTime.activeDays : []),
                    ...(Array.isArray(incomingTime.activeDays) ? incomingTime.activeDays : [])
                ].filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))].sort((a, b) => a - b),
                timezone: typeof previousTime.timezone === 'string' ? previousTime.timezone : 'unknown'
            },
            emotionSignature: incoming.emotionSignature || previous.emotionSignature || {},
            pressureTactics: uniqueStrings(previous.pressureTactics, incoming.pressureTactics),
            pressureVelocity: typeof incoming.pressureVelocity === 'string'
                ? incoming.pressureVelocity
                : (previous.pressureVelocity || 'medium')
        };
    }

    /**
     * Merge psychological data
     */
    _mergePsychological(existing = {}, newData = {}) {
        const previous = existing && typeof existing === 'object' ? existing : {};
        const incoming = newData && typeof newData === 'object' ? newData : {};
        const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
        const techniques = [
            ...(Array.isArray(previous.manipulationTechniques) ? previous.manipulationTechniques : []),
            ...(Array.isArray(incoming.manipulationTechniques) ? incoming.manipulationTechniques : [])
        ].filter((value) => typeof value === 'string' && value.trim());

        return {
            primaryTactic: typeof previous.primaryTactic === 'string'
                ? previous.primaryTactic
                : (incoming.primaryTactic || 'urgency'),
            sophistication: this._maxSophistication(
                previous.sophistication || 'low',
                incoming.sophistication || 'low'
            ),
            adaptability: Math.max(0, Math.min(1, (
                numberOr(previous.adaptability, 0.5) + numberOr(incoming.adaptability, 0.5)
            ) / 2)),
            persistenceScore: Math.max(
                0,
                Math.min(1, Math.max(numberOr(previous.persistenceScore, 0), numberOr(incoming.persistenceScore, 0)))
            ),
            manipulationTechniques: [...new Set(techniques)].slice(0, 100)
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
            // The shared extractor intentionally keeps its evaluator response shape;
            // email extraction is added here for profile correlation only.
            const knownUpiIds = new Set(intel.upiIds.map((value) => value.toLowerCase()));
            const emails = message.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
            identifiers.emailAddresses.push(...emails.filter((value) => !knownUpiIds.has(value.toLowerCase())));
        }

        // Deduplicate and bound every identifier class. Email addresses used to
        // be the only class left unbounded, allowing repeated/large conversations
        // to grow profile documents indefinitely.
        for (const field of Object.keys(identifiers)) {
            identifiers[field] = [...new Set(identifiers[field]
                .filter((value) => typeof value === 'string' && value.trim())
                .map((value) => value.trim()))].slice(-500);
        }

        return identifiers;
    }

    /**
     * Calculate overall risk score
     */
    _calculateRiskScore(profile) {
        let score = 0;

        // Session count contribution (more sessions = higher risk)
        score += Math.min((profile.intelligence?.totalVictimAttempts || profile.sessions.length) * 5, 30);

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
        if ((profile.intelligence.totalVictimAttempts || profile.sessions.length) > 10) {
            score += 15;
        } else if ((profile.intelligence.totalVictimAttempts || profile.sessions.length) > 5) {
            score += 10;
        }

        return Math.min(Math.round(score), 100);
    }

    /**
     * Match profiles to find similar scammers
     */
    async matchProfiles(targetProfileId, limit = 10) {
        if (typeof targetProfileId !== 'string' || !targetProfileId.trim() || targetProfileId.length > 256) {
            return [];
        }
        const requestedLimit = Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 10;
        const resultLimit = Math.max(1, Math.min(requestedLimit, 50));
        const targetId = targetProfileId.trim();

        const targetProfile = await ScammerProfile.findOne({ profileId: targetId })
            .select('profileId psychologicalProfile.primaryTactic psychologicalProfile.sophistication behavioralFingerprint.pressureTactics behavioralFingerprint.languagePatterns')
            .lean();
        if (!targetProfile) {
            return [];
        }

        // Similarity is a bounded analyst aid, not a full-database attribution
        // operation. Restrict the candidate scan and project only fields used by
        // the scoring functions so profile growth cannot turn one request into an
        // unbounded collection read.
        const candidates = await ScammerProfile.find({
            profileId: { $ne: targetId },
            status: 'active'
        })
            .select('profileId status riskScore lastSeen psychologicalProfile.primaryTactic psychologicalProfile.sophistication behavioralFingerprint.pressureTactics behavioralFingerprint.languagePatterns')
            .sort({ riskScore: -1, lastSeen: -1 })
            .limit(500)
            .lean();

        const matches = candidates.map(profile => ({
            profile,
            similarity: this._calculateSimilarity(targetProfile, profile)
        }))
            .filter(m => m.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, resultLimit);

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
        const psychology1 = profile1?.psychologicalProfile || {};
        const psychology2 = profile2?.psychologicalProfile || {};
        const behavior1 = profile1?.behavioralFingerprint || {};
        const behavior2 = profile2?.behavioralFingerprint || {};
        const tactics1 = Array.isArray(behavior1.pressureTactics) ? behavior1.pressureTactics : [];
        const tactics2 = Array.isArray(behavior2.pressureTactics) ? behavior2.pressureTactics : [];
        const patterns1 = Array.isArray(behavior1.languagePatterns) ? behavior1.languagePatterns : [];
        const patterns2 = Array.isArray(behavior2.languagePatterns) ? behavior2.languagePatterns : [];

        // Legacy documents may have incomplete nested fields; missing evidence
        // should contribute no similarity rather than throwing during triage.
        if (psychology1.primaryTactic && psychology2.primaryTactic) {
            if (psychology1.primaryTactic === psychology2.primaryTactic) score += 0.3;
            factors++;
        }

        if (psychology1.sophistication && psychology2.sophistication) {
            if (psychology1.sophistication === psychology2.sophistication) score += 0.2;
            factors++;
        }

        if (tactics1.length || tactics2.length) {
            const sharedTactics = tactics1.filter(t => tactics2.includes(t));
            score += (sharedTactics.length / Math.max(tactics1.length, tactics2.length, 1)) * 0.3;
            factors++;
        }

        if (patterns1.length || patterns2.length) {
            const sharedPatterns = patterns1.filter(p => patterns2.includes(p));
            score += (sharedPatterns.length / Math.max(patterns1.length, patterns2.length, 1)) * 0.2;
            factors++;
        }

        return factors ? score / factors : 0;
    }

    /**
     * Identify shared traits between profiles
     */
    _identifySharedTraits(profile1, profile2) {
        const traits = [];
        const psychology1 = profile1?.psychologicalProfile || {};
        const psychology2 = profile2?.psychologicalProfile || {};
        const behavior1 = profile1?.behavioralFingerprint || {};
        const behavior2 = profile2?.behavioralFingerprint || {};
        const tactics1 = Array.isArray(behavior1.pressureTactics) ? behavior1.pressureTactics : [];
        const tactics2 = Array.isArray(behavior2.pressureTactics) ? behavior2.pressureTactics : [];

        if (psychology1.primaryTactic && psychology1.primaryTactic === psychology2.primaryTactic) {
            traits.push(`Same primary tactic: ${psychology1.primaryTactic}`);
        }

        const sharedTactics = tactics1.filter(t => tactics2.includes(t));
        if (sharedTactics.length > 0) {
            traits.push(`Shared tactics: ${sharedTactics.join(', ')}`);
        }

        return traits;
    }
}

module.exports = new ProfilerService();
