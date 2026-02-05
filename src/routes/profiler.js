// src/routes/profiler.js
const express = require('express');
const router = express.Router();
const profilerService = require('../services/profilerService');
const ScammerProfile = require('../models/ScammerProfile');

/**
 * @route GET /api/v1/profiles
 * @desc Get all scammer profiles
 */
router.get('/', async (req, res) => {
    try {
        const { limit = 50, status, minRisk } = req.query;

        const query = {};
        if (status) query.status = status;
        if (minRisk) query.riskScore = { $gte: parseInt(minRisk) };

        const profiles = await ScammerProfile.find(query)
            .sort({ riskScore: -1, lastSeen: -1 })
            .limit(parseInt(limit));

        res.json({ status: 'success', data: profiles, count: profiles.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/profiles/:id
 * @desc Get specific profile
 */
router.get('/:id', async (req, res) => {
    try {
        const profile = await ScammerProfile.findOne({ profileId: req.params.id });

        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Profile not found' });
        }

        res.json({ status: 'success', data: profile });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/profiles/analyze
 * @desc Analyze session and create/update profile
 */
router.post('/analyze', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ status: 'error', message: 'sessionId required' });
        }

        const profile = await profilerService.buildProfile(sessionId);

        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Session not found or no data to profile' });
        }

        res.json({ status: 'success', data: profile });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/profiles/match/:id
 * @desc Find similar profiles
 */
router.get('/match/:id', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const matches = await profilerService.matchProfiles(req.params.id, parseInt(limit));
        res.json({ status: 'success', data: matches, count: matches.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
