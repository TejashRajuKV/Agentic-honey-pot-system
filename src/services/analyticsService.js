// src/services/analyticsService.js
const Analytics = require('../models/Analytics');
const Session = require('../models/Session');
const ConversationTurn = require('../models/ConversationTurn');
const QualityMetrics = require('../models/QualityMetrics');
const ScammerProfile = require('../models/ScammerProfile');

/**
 * Analytics Service
 * Aggregates metrics and provides insights for dashboard
 */
class AnalyticsService {
    /**
     * Aggregate daily metrics for a specific date
     */
    async aggregateDailyMetrics(date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get all sessions for this day
        const sessions = await Session.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        // Calculate core metrics
        const totalSessions = sessions.length;
        const scamsDetected = sessions.filter(s => s.scamEverDetected).length;
        const avgConfidence = sessions.reduce((sum, s) => sum + (s.maxScamProbability || 0), 0) / totalSessions || 0;

        // Count scam types
        const scamTypeCounts = {};
        const hourlyDist = new Array(24).fill(0);
        const langBreakdown = { english: 0, hindi: 0, hinglish: 0, other: 0 };
        const phaseDist = { early: 0, mid: 0, late: 0, final: 0 };

        for (const session of sessions) {
            // Hour distribution
            const hour = new Date(session.createdAt).getHours();
            hourlyDist[hour]++;

            // Phase distribution
            if (session.highestPhase) {
                phaseDist[session.highestPhase]++;
            }

            // Note: scamType would come from conversation turns analysis
            // For now, we'll extract from patterns if available
        }

        // Get all conversation turns for pattern analysis
        const turns = await ConversationTurn.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        const patternFrequency = {};
        for (const turn of turns) {
            if (turn.metadata?.detectedPatterns) {
                for (const pattern of turn.metadata.detectedPatterns) {
                    if (!patternFrequency[pattern]) {
                        patternFrequency[pattern] = { count: 0, totalConf: 0 };
                    }
                    patternFrequency[pattern].count++;
                    patternFrequency[pattern].totalConf += turn.metadata.scamProbability || 0;
                }
            }
        }

        const patternTrends = Object.entries(patternFrequency).map(([pattern, data]) => ({
            pattern,
            frequency: data.count,
            avgConfidence: data.totalConf / data.count
        })).sort((a, b) => b.frequency - a.frequency).slice(0, 20);

        // Top scam types
        const topScamTypes = Object.entries(scamTypeCounts)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Get quality metrics
        const qualityMetrics = await QualityMetrics.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });

        let qualityScores = { avg: 0, min: 1, max: 0 };
        if (qualityMetrics.length > 0) {
            const scores = qualityMetrics.map(q => q.scores.overall);
            qualityScores = {
                avg: scores.reduce((a, b) => a + b, 0) / scores.length,
                min: Math.min(...scores),
                max: Math.max(...scores)
            };
        }

        // Threat intelligence summary
        const newScammersToday = await ScammerProfile.countDocuments({
            firstSeen: { $gte: startOfDay, $lte: endOfDay }
        });

        const knownScammersActive = await ScammerProfile.countDocuments({
            lastSeen: { $gte: startOfDay, $lte: endOfDay },
            firstSeen: { $lt: startOfDay }
        });

        // Create or update analytics record
        const analyticsData = {
            date: startOfDay,
            metrics: {
                totalSessions,
                scamsDetected,
                averageConfidence: avgConfidence,
                topScamTypes,
                hourlyDistribution: hourlyDist,
                languageBreakdown: langBreakdown,
                qualityScores,
                phaseDistribution: phaseDist
            },
            patternTrends,
            threatSummary: {
                newScammers: newScammersToday,
                knownScammers: knownScammersActive,
                crossSessionMatches: 0 // Will be calculated by correlation service
            },
            alertStats: {
                totalAlerts: 0,
                criticalAlerts: 0
            }
        };

        const analytics = await Analytics.findOneAndUpdate(
            { date: startOfDay },
            analyticsData,
            { upsert: true, new: true }
        );

        return analytics;
    }

    /**
     * Get pattern trends over a date range
     */
    async getPatternTrends(startDate, endDate) {
        const analytics = await Analytics.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        // Compile trends across multiple days
        const trendMap = new Map();

        for (const day of analytics) {
            for (const trend of day.patternTrends) {
                if (!trendMap.has(trend.pattern)) {
                    trendMap.set(trend.pattern, {
                        pattern: trend.pattern,
                        timeline: [],
                        totalFrequency: 0,
                        avgConfidence: 0
                    });
                }

                const existing = trendMap.get(trend.pattern);
                existing.timeline.push({
                    date: day.date,
                    frequency: trend.frequency,
                    confidence: trend.avgConfidence
                });
                existing.totalFrequency += trend.frequency;
                existing.avgConfidence =
                    (existing.avgConfidence * (existing.timeline.length - 1) + trend.avgConfidence) /
                    existing.timeline.length;
            }
        }

        return Array.from(trendMap.values())
            .sort((a, b) => b.totalFrequency - a.totalFrequency)
            .slice(0, 20);
    }

    /**
     * Get heatmap data (hour x day of week)
     */
    async getScamHeatmap(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const sessions = await Session.find({
            createdAt: { $gte: startDate },
            scamEverDetected: true
        });

        // Create 7x24 heatmap (day of week x hour of day)
        const heatmap = Array(7).fill(0).map(() => Array(24).fill(0));

        for (const session of sessions) {
            const date = new Date(session.createdAt);
            const dayOfWeek = date.getDay(); // 0-6
            const hour = date.getHours(); // 0-23
            heatmap[dayOfWeek][hour]++;
        }

        return {
            data: heatmap,
            labels: {
                days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                hours: Array.from({ length: 24 }, (_, i) => `${i}:00`)
            },
            totalScams: sessions.length,
            dateRange: { start: startDate, end: new Date() }
        };
    }

    /**
     * Get top scammers by activity
     */
    async getTopScammers(limit = 10) {
        const scammers = await ScammerProfile.find({ status: 'active' })
            .sort({ 'intelligence.totalVictimAttempts': -1, riskScore: -1 })
            .limit(limit)
            .select('profileId identifiers psychologicalProfile riskScore intelligence lastSeen');

        return scammers;
    }

    /**
     * Get language statistics
     */
    async getLanguageStats(days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const analytics = await Analytics.find({
            date: { $gte: startDate }
        });

        const totals = {
            english: 0,
            hindi: 0,
            hinglish: 0,
            other: 0
        };

        for (const day of analytics) {
            totals.english += day.metrics.languageBreakdown.english || 0;
            totals.hindi += day.metrics.languageBreakdown.hindi || 0;
            totals.hinglish += day.metrics.languageBreakdown.hinglish || 0;
            totals.other += day.metrics.languageBreakdown.other || 0;
        }

        const total = Object.values(totals).reduce((a, b) => a + b, 0);

        return {
            counts: totals,
            percentages: {
                english: total > 0 ? (totals.english / total * 100).toFixed(1) : 0,
                hindi: total > 0 ? (totals.hindi / total * 100).toFixed(1) : 0,
                hinglish: total > 0 ? (totals.hinglish / total * 100).toFixed(1) : 0,
                other: total > 0 ? (totals.other / total * 100).toFixed(1) : 0
            },
            total,
            dateRange: { start: startDate, end: new Date() }
        };
    }

    /**
     * Export analytics data
     */
    async exportAnalytics(startDate, endDate, format = 'json') {
        const analytics = await Analytics.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        if (format === 'json') {
            return analytics;
        }

        if (format === 'csv') {
            // Convert to CSV
            const rows = analytics.map(a => ({
                date: a.date.toISOString().split('T')[0],
                totalSessions: a.metrics.totalSessions,
                scamsDetected: a.metrics.scamsDetected,
                avgConfidence: a.metrics.averageConfidence.toFixed(2),
                avgQuality: a.metrics.qualityScores.avg.toFixed(2),
                newScammers: a.threatSummary.newScammers,
                knownScammers: a.threatSummary.knownScammers
            }));

            const headers = Object.keys(rows[0]).join(',');
            const csvRows = rows.map(r => Object.values(r).join(','));
            return [headers, ...csvRows].join('\n');
        }

        return analytics;
    }

    /**
     * Get dashboard overview (all key metrics)
     */
    async getDashboardOverview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);

        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);

        // Today's metrics
        const todayMetrics = await this.aggregateDailyMetrics(today);

        // 7-day trends
        const weeklyAnalytics = await Analytics.find({
            date: { $gte: last7Days }
        }).sort({ date: 1 });

        const weeklyAvg = {
            sessions: weeklyAnalytics.reduce((sum, a) => sum + a.metrics.totalSessions, 0) / 7,
            scams: weeklyAnalytics.reduce((sum, a) => sum + a.metrics.scamsDetected, 0) / 7,
            confidence: weeklyAnalytics.reduce((sum, a) => sum + a.metrics.averageConfidence, 0) / 7
        };

        // Total counts
        const totalSessions = await Session.countDocuments();
        const totalScams = await Session.countDocuments({ scamEverDetected: true });
        const activeScammers = await ScammerProfile.countDocuments({ status: 'active' });

        return {
            today: {
                sessions: todayMetrics.metrics.totalSessions,
                scams: todayMetrics.metrics.scamsDetected,
                confidence: todayMetrics.metrics.averageConfidence,
                quality: todayMetrics.metrics.qualityScores.avg
            },
            weekly: weeklyAvg,
            totals: {
                sessions: totalSessions,
                scams: totalScams,
                scammers: activeScammers,
                detectionRate: totalSessions > 0 ? (totalScams / totalSessions * 100).toFixed(1) : 0
            },
            trends: weeklyAnalytics.map(a => ({
                date: a.date,
                sessions: a.metrics.totalSessions,
                scams: a.metrics.scamsDetected
            }))
        };
    }
}

module.exports = new AnalyticsService();
