// src/routes/quality.js
const express = require('express');
const router = express.Router();
const qualityService = require('../services/qualityService');

/**
 * @route GET /api/v1/quality/session/:sessionId
 * @desc Get quality metrics for a session
 */
router.get('/session/:sessionId', async (req, res) => {
    try {
        const QualityMetrics = require('../models/QualityMetrics');
        const metrics = await QualityMetrics.find({ sessionId: req.params.sessionId })
            .sort({ turnNumber: 1 });

        res.json({ status: 'success', data: metrics, count: metrics.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/quality/report/:sessionId
 * @desc Get comprehensive quality report for a session
 */
router.get('/report/:sessionId', async (req, res) => {
    try {
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
        const { limit = 100 } = req.query;

        const metrics = await QualityMetrics.find()
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

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
        const repetition = await qualityService.detectRepetition(req.params.sessionId);
        res.json({ status: 'success', data: repetition });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
