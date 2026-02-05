// src/services/qualityService.js
const QualityMetrics = require('../models/QualityMetrics');
const ConversationTurn = require('../models/ConversationTurn');

/**
 * Quality Scoring Service
 * Evaluates conversation quality and response effectiveness
 */
class QualityService {
    /**
     * Score a single response
     */
    async scoreResponse(agentMessage, scammerMessage, context) {
        const scores = {
            naturalness: this._scoreNaturalness(agentMessage),
            coherence: this._scoreCoherence(agentMessage, context),
            relevance: this._scoreRelevance(agentMessage, scammerMessage),
            strategicValue: this._scoreStrategicValue(agentMessage, context),
            overall: 0
        };

        // Calculate weighted overall score
        scores.overall = (
            scores.naturalness * 0.25 +
            scores.coherence * 0.25 +
            scores.relevance * 0.25 +
            scores.strategicValue * 0.25
        );

        // Detect quality flags
        const flags = this._detectQualityFlags(agentMessage, context);

        // Create quality metrics record
        const metrics = await QualityMetrics.create({
            sessionId: context.sessionId,
            turnNumber: context.turnNumber,
            scores,
            flags,
            analysis: {
                agentMessage,
                scammerMessage,
                phaseAtTime: context.phase,
                riskAtTime: context.riskScore,
                emotionAtTime: context.emotion,
                breakdown: this._getScoreBreakdown(agentMessage, context)
            },
            comparison: await this._getComparison(context.sessionId, scores.overall),
            evaluatedBy: 'rule_based'
        });

        return metrics;
    }

    /**
     * Score naturalness (how human-like)
     */
    _scoreNaturalness(message) {
        let score = 0.5;

        // Check for conversational elements
        if (/\?/.test(message)) score += 0.1; // Has questions
        if (/[.!,]/.test(message)) score += 0.05; // Has punctuation
        if (message.length > 20 && message.length < 150) score += 0.1; // Appropriate length
        if (/\b(oh|um|uh|hmm|okay|alright)\b/i.test(message)) score += 0.1; // Conversational fillers
        if (!/perfect|exactly|precisely/i.test(message)) score += 0.05; // Not too perfect

        // Penalize unnatural patterns
        if (message.length > 200) score -= 0.1; // Too long
        if (message.split(' ').length < 3) score -= 0.1; // Too short
        if (/\b(greetings|salutations)\b/i.test(message)) score -= 0.05; // Too formal

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score coherence with conversation history
     */
    _scoreCoherence(message, context) {
        let score = 0.5;

        const history = context.conversationHistory || [];
        if (history.length === 0) return 0.7; // First message, assume coherent

        // Check if references previous topics
        const previousTopics = history.filter(h => h.role === 'user').map(h => h.text);
        const hasReference = previousTopics.some(topic => {
            const keywords = topic.toLowerCase().split(' ').filter(w => w.length > 4);
            return keywords.some(k => message.toLowerCase().includes(k));
        });

        if (hasReference) score += 0.2;

        // Check persona consistency
        if (context.persona) {
            const personaTraits = context.persona.traits || [];
            if (personaTraits.includes('confused') && /\?|don't understand|not sure/i.test(message)) {
                score += 0.15;
            }
            if (personaTraits.includes('cautious') && /why|suspicious|careful/i.test(message)) {
                score += 0.15;
            }
        }

        // Check emotional consistency
        if (context.emotionHistory) {
            const lastEmotion = context.emotionHistory[context.emotionHistory.length - 1];
            if (lastEmotion === 'fear' && /scared|worried|concerned/i.test(message)) {
                score += 0.1;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score relevance to scammer's message
     */
    _scoreRelevance(agentMessage, scammerMessage) {
        let score = 0.5;

        if (!scammerMessage) return 0.5;

        // Check if addresses content
        const scammerKeywords = scammerMessage.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 4);

        const addressedKeywords = scammerKeywords.filter(k =>
            agentMessage.toLowerCase().includes(k)
        );

        if (addressedKeywords.length > 0) {
            score += Math.min(0.3, addressedKeywords.length * 0.1);
        }

        // Check for question answering
        if (/\?/.test(scammerMessage) && !/\?$/.test(agentMessage)) {
            score += 0.1; // Scammer asked question, agent didn't just ask back
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score strategic value (info extraction, time wasting)
     */
    _scoreStrategicValue(message, context) {
        let score = 0.3;

        // Questions extract information
        const questionCount = (message.match(/\?/g) || []).length;
        score += Math.min(0.3, questionCount * 0.15);

        // Delays are valuable in late phase
        if (context.phase === 'late' || context.phase === 'final') {
            if (/wait|busy|later|tomorrow|can't right now/i.test(message)) {
                score += 0.2;
            }
        }

        // Expressing suspicion is valuable when risk is high
        if (context.riskScore > 60) {
            if (/suspicious|scam|fraud|police/i.test(message)) {
                score += 0.15;
            }
        }

        // Building rapport in early phase
        if (context.phase === 'early') {
            if (/yes|okay|understand|help/i.test(message)) {
                score += 0.15;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Detect quality flags/issues
     */
    _detectQualityFlags(message, context) {
        const flags = [];

        // Repetition check
        const history = context.conversationHistory || [];
        const agentMessages = history.filter(h => h.role === 'assistant').map(h => h.text);

        if (agentMessages.some(m => m === message)) {
            flags.push({ type: 'repetitive', severity: 'high', description: 'Exact message repeated' });
        }

        const messageLower = message.toLowerCase();
        if (agentMessages.some(m => {
            const similarity = this._calculateSimilarity(m.toLowerCase(), messageLower);
            return similarity > 0.8;
        })) {
            flags.push({ type: 'repetitive', severity: 'medium', description: 'Similar message repeated' });
        }

        // Off-topic check
        if (context.phase === 'late' && /excited|happy|great|wonderful/i.test(message)) {
            flags.push({ type: 'out_of_character', severity: 'medium', description: 'Too positive in late phase' });
        }

        // Too eager in high risk
        if (context.riskScore > 70 && /yes|sure|okay|will do/i.test(message) && !/but|however|wait/i.test(message)) {
            flags.push({ type: 'too_eager', severity: 'high', description: 'Too compliant with high-risk request' });
        }

        // Length issues
        if (message.length < 10) {
            flags.push({ type: 'unrealistic', severity: 'low', description: 'Message too short' });
        } else if (message.length > 300) {
            flags.push({ type: 'unrealistic', severity: 'low', description: 'Message too long' });
        }

        return flags;
    }

    /**
     * Get detailed score breakdown
     */
    _getScoreBreakdown(message, context) {
        return {
            hasTypos: /dont|wont|cant|whats/.test(message.toLowerCase()),
            usesColloquialisms: /\b(yeah|nah|gonna|wanna|kinda)\b/i.test(message),
            appropriateLength: message.length >= 20 && message.length <= 150,
            referencesHistory: context.conversationHistory?.length > 0,
            maintainsPersona: true, // Simplified
            logicalFlow: true,
            addressesQuestion: /\?/.test(context.lastScammerMessage || ''),
            staysOnTopic: true,
            extractsInfo: /\?/.test(message),
            createsDelay: /wait|busy|later/i.test(message),
            buildsRapport: /understand|help|yes/i.test(message)
        };
    }

    /**
     * Calculate text similarity (Jaccard similarity)
     */
    _calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size;
    }

    /**
     * Get comparison with averages
     */
    async _getComparison(sessionId, overallScore) {
        // Session average
        const sessionMetrics = await QualityMetrics.find({ sessionId });
        const sessionAvg = sessionMetrics.length > 0
            ? sessionMetrics.reduce((sum, m) => sum + m.scores.overall, 0) / sessionMetrics.length
            : 0.5;

        // Global average (last 100 records)
        const globalMetrics = await QualityMetrics.find()
            .sort({ timestamp: -1 })
            .limit(100);
        const globalAvg = globalMetrics.length > 0
            ? globalMetrics.reduce((sum, m) => sum + m.scores.overall, 0) / globalMetrics.length
            : 0.5;

        // Determine trend
        let trend = 'stable';
        if (sessionMetrics.length >= 3) {
            const recent3 = sessionMetrics.slice(-3);
            const avgRecent = recent3.reduce((sum, m) => sum + m.scores.overall, 0) / 3;
            const previous3 = sessionMetrics.slice(-6, -3);
            if (previous3.length === 3) {
                const avgPrevious = previous3.reduce((sum, m) => sum + m.scores.overall, 0) / 3;
                if (avgRecent > avgPrevious + 0.1) trend = 'improving';
                else if (avgRecent < avgPrevious - 0.1) trend = 'declining';
            }
        }

        return {
            vsSessionAvg: overallScore - sessionAvg,
            vsGlobalAvg: overallScore - globalAvg,
            trend
        };
    }

    /**
     * Detect repetition in conversation
     */
    async detectRepetition(sessionId) {
        const turns = await ConversationTurn.find({ sessionId, role: 'assistant' }).sort({ timestamp: 1 });

        const repetitions = [];
        const seen = new Map();

        for (let i = 0; i < turns.length; i++) {
            const text = turns[i].text.toLowerCase();

            if (seen.has(text)) {
                repetitions.push({
                    currentTurn: i,
                    previousTurn: seen.get(text),
                    message: text
                });
            } else {
                seen.set(text, i);
            }
        }

        return {
            hasRepetition: repetitions.length > 0,
            count: repetitions.length,
            details: repetitions
        };
    }

    /**
     * Generate quality report for session
     */
    async generateQualityReport(sessionId) {
        const metrics = await QualityMetrics.find({ sessionId }).sort({ turnNumber: 1 });

        if (metrics.length === 0) {
            return { sessionId, noData: true };
        }

        const avgScores = {
            naturalness: 0,
            coherence: 0,
            relevance: 0,
            strategicValue: 0,
            overall: 0
        };

        for (const metric of metrics) {
            avgScores.naturalness += metric.scores.naturalness;
            avgScores.coherence += metric.scores.coherence;
            avgScores.relevance += metric.scores.relevance;
            avgScores.strategicValue += metric.scores.strategicValue;
            avgScores.overall += metric.scores.overall;
        }

        const count = metrics.length;
        for (const key in avgScores) {
            avgScores[key] = (avgScores[key] / count).toFixed(3);
        }

        // Collect all flags
        const allFlags = metrics.flatMap(m => m.flags);
        const flagCounts = {};
        allFlags.forEach(f => {
            flagCounts[f.type] = (flagCounts[f.type] || 0) + 1;
        });

        // Quality trend
        const scores = metrics.map(m => m.scores.overall);
        const trend = this._analyzeTrend(scores);

        return {
            sessionId,
            totalTurns: count,
            averageScores: avgScores,
            minScore: Math.min(...scores).toFixed(3),
            maxScore: Math.max(...scores).toFixed(3),
            flags: {
                total: allFlags.length,
                byType: flagCounts
            },
            trend,
            recommendation: this._getRecommendation(avgScores, allFlags)
        };
    }

    /**
     * Analyze score trend
     */
    _analyzeTrend(scores) {
        if (scores.length < 3) return 'insufficient_data';

        const half = Math.floor(scores.length / 2);
        const firstHalf = scores.slice(0, half);
        const secondHalf = scores.slice(half);

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (avgSecond > avgFirst + 0.1) return 'improving';
        if (avgSecond < avgFirst - 0.1) return 'declining';
        return 'stable';
    }

    /**
     * Get recommendation based on quality
     */
    _getRecommendation(avgScores, flags) {
        const overall = parseFloat(avgScores.overall);

        if (overall >= 0.7) {
            return {
                level: 'good',
                message: 'Quality is good. Agent performing well.',
                suggestions: []
            };
        }

        if (overall >= 0.5) {
            const suggestions = [];
            if (parseFloat(avgScores.naturalness) < 0.5) {
                suggestions.push('Improve naturalness: Add more conversational elements');
            }
            if (parseFloat(avgScores.coherence) < 0.5) {
                suggestions.push('Improve coherence: Better reference to conversation history');
            }
            if (flags.length > 5) {
                suggestions.push('Reduce quality flags: Address repetition and consistency issues');
            }

            return {
                level: 'acceptable',
                message: 'Quality is acceptable but could be improved.',
                suggestions
            };
        }

        return {
            level: 'poor',
            message: 'Quality is below acceptable threshold. Immediate improvement needed.',
            suggestions: [
                'Review agent response generation logic',
                'Increase persona consistency',
                'Reduce repetitive responses',
                'Improve context awareness'
            ]
        };
    }
}

module.exports = new QualityService();
