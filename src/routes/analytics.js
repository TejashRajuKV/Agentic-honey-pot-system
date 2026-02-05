// src/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');

/**
 * @route GET /api/v1/analytics/dashboard
 * @desc Get dashboard overview with key metrics
 */
router.get('/dashboard', async (req, res) => {
    try {
        const overview = await analyticsService.getDashboardOverview();
        res.json({ status: 'success', data: overview });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/analytics/trends
 * @desc Get pattern trends over date range
 */
router.get('/trends', async (req, res) => {
    try {
        const { startDate, endDate, days = 30 } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const trends = await analyticsService.getPatternTrends(start, end);
        res.json({ status: 'success', data: trends });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/analytics/heatmap
 * @desc Get scam heatmap data (time-based distribution)
 */
router.get('/heatmap', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const heatmap = await analyticsService.getScamHeatmap(parseInt(days));
        res.json({ status: 'success', data: heatmap });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/analytics/top-scammers
 * @desc Get top scammers by activity
 */
router.get('/top-scammers', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const scammers = await analyticsService.getTopScammers(parseInt(limit));
        res.json({ status: 'success', data: scammers });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/analytics/language-stats
 * @desc Get language usage statistics
 */
router.get('/language-stats', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const stats = await analyticsService.getLanguageStats(parseInt(days));
        res.json({ status: 'success', data: stats });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/analytics/export
 * @desc Export analytics data
 */
router.get('/export', async (req, res) => {
    try {
        const { startDate, endDate, format = 'json', days = 30 } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const data = await analyticsService.exportAnalytics(start, end, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=analytics_${Date.now()}.csv`);
            res.send(data);
        } else {
            res.json({ status: 'success', data });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/analytics/aggregate
 * @desc Manually trigger analytics aggregation for a date
 */
router.post('/aggregate', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date ? new Date(date) : new Date();

        const analytics = await analyticsService.aggregateDailyMetrics(targetDate);
        res.json({ status: 'success', data: analytics });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
