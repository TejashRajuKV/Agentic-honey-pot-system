// src/routes/quality.js
const express = require('express');
const router = express.Router();
const qualityService = require('../services/qualityService');

function validSessionId(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
        && !value.includes('/') && !value.includes('\\') && !/[\\x00-\\x1f\\x7f]/.test(value);
}

function boundedLimit(value, fallback = 100, maximum = 500) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, maximum);
}

/**
 * @route GET /api/v1/quality/session/:sessionId
 * @desc Get quality metrics for a session
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const QualityMetrics = require('../models/QualityMetrics');
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const metrics = await QualityMetrics.find({ sessionId: req.params.sessionId })
            .sort({ turnNumber: 1 }).limit(5000);

        res.json({ status: 'success', data: metrics, count: metrics.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to retrieve quality data' });
    }
});

/**
 * @route GET /api/v1/quality/report/:sessionId
 * @desc Get comprehensive quality report for a session
 */
router.get('/report/:sessionId', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const report = await qualityService.generateQualityReport(req.params.sessionId);
        res.json({ status: 'success', data: report });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/quality/metrics
 * @desc Get overall quality metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const QualityMetrics = require('../models/QualityMetrics');
        const limit = boundedLimit(req.query.limit, 100, 500);
        if (limit === null) return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });

        const metrics = await QualityMetrics.find()
            .sort({ timestamp: -1 })
            .limit(limit);

        // Calculate aggregate metrics
        const avgScores = {
            naturalness: 0,
            coherence: 0,
            relevance: 0,
            strategicValue: 0,
            overall: 0
        };

        metrics.forEach(m => {
            avgScores.naturalness += m.scores.naturalness;
            avgScores.coherence += m.scores.coherence;
            avgScores.relevance += m.scores.relevance;
            avgScores.strategicValue += m.scores.strategicValue;
            avgScores.overall += m.scores.overall;
        });

        const count = metrics.length;
        if (count > 0) {
            for (const key in avgScores) {
                avgScores[key] = (avgScores[key] / count).toFixed(3);
            }
        }

        res.json({
            status: 'success',
            data: {
                totalEvaluations: count,
                averageScores: avgScores,
                recentMetrics: metrics.slice(0, 20)
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/quality/repetition/:sessionId
 * @desc Check for repetition in a session
 */
router.get('/repetition/:sessionId', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        const repetition = await qualityService.detectRepetition(req.params.sessionId);
        res.json({ status: 'success', data: repetition });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
