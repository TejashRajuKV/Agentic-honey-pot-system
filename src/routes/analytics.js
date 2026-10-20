// src/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

function boundedInteger(value, fallback, maximum) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, maximum);
}

function resolveDateRange({ startDate, endDate, days }, fallbackDays = 30) {
    const span = boundedInteger(days, fallbackDays, 366);
    if (span === null) return { error: 'days must be a positive integer' };
    const start = startDate !== undefined ? new Date(startDate) : new Date(Date.now() - span * 86400000);
    const end = endDate !== undefined ? new Date(endDate) : new Date();
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
        return { error: 'startDate and endDate must be valid dates' };
    }
    if (start > end) return { error: 'startDate must not be after endDate' };
    if (end.getTime() - start.getTime() > 366 * 86400000) {
        return { error: 'Date range cannot exceed 366 days' };
    }
    return { start, end };
}

/**
 * @route GET /api/v1/analytics/dashboard
 * @desc Get dashboard overview with key metrics
 */
router.get('/dashboard', async (req, res) => {
    try {
        const overview = await analyticsService.getDashboardOverview();
        res.json({ status: 'success', data: overview });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route GET /api/v1/analytics/trends
 * @desc Get pattern trends over date range
 */
router.get('/trends', async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        if (range.error) return res.status(400).json({ status: 'error', message: range.error });

        const trends = await analyticsService.getPatternTrends(range.start, range.end);
        res.json({ status: 'success', data: trends });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route GET /api/v1/analytics/heatmap
 * @desc Get scam heatmap data (time-based distribution)
 */
router.get('/heatmap', async (req, res) => {
    try {
        const days = boundedInteger(req.query.days, 30, 366);
        if (days === null) return res.status(400).json({ status: 'error', message: 'days must be a positive integer' });
        const heatmap = await analyticsService.getScamHeatmap(days);
        res.json({ status: 'success', data: heatmap });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route GET /api/v1/analytics/top-scammers
 * @desc Get top scammers by activity
 */
router.get('/top-scammers', async (req, res) => {
    try {
        const limit = boundedInteger(req.query.limit, 10, 100);
        if (limit === null) return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        const scammers = await analyticsService.getTopScammers(limit);
        res.json({ status: 'success', data: scammers });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route GET /api/v1/analytics/language-stats
 * @desc Get language usage statistics
 */
router.get('/language-stats', async (req, res) => {
    try {
        const days = boundedInteger(req.query.days, 30, 366);
        if (days === null) return res.status(400).json({ status: 'error', message: 'days must be a positive integer' });
        const stats = await analyticsService.getLanguageStats(days);
        res.json({ status: 'success', data: stats });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route GET /api/v1/analytics/export
 * @desc Export analytics data
 */
router.get('/export', async (req, res) => {
    try {
        const range = resolveDateRange(req.query, 30);
        if (range.error) return res.status(400).json({ status: 'error', message: range.error });
        const format = req.query.format ?? 'json';
        if (!['json', 'csv'].includes(format)) {
            return res.status(400).json({ status: 'error', message: 'format must be json or csv' });
        }

        const data = await analyticsService.exportAnalytics(range.start, range.end, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.csv`);
            res.send(data);
        } else {
            res.json({ status: 'success', data });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

/**
 * @route POST /api/v1/analytics/aggregate
 * @desc Manually trigger analytics aggregation for a date
 */
router.post('/aggregate', async (req, res) => {
    try {
        const date = req.body?.date;
        const targetDate = date === undefined ? new Date() : new Date(date);
        if (!Number.isFinite(targetDate.getTime())) {
            return res.status(400).json({ status: 'error', message: 'date must be a valid date' });
        }

        const analytics = await analyticsService.aggregateDailyMetrics(targetDate);
        res.json({ status: 'success', data: analytics });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve analytics data' });
    }
});

module.exports = router;
