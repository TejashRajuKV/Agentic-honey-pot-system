// src/routes/profiler.js
const express = require('express');
const router = express.Router();
const profilerService = require('../services/profilerService');
const ScammerProfile = require('../models/ScammerProfile');

function validIdentifier(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
        && !value.includes('/') && !value.includes('\\') && ![...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
}

function boundedInteger(value, fallback, maximum) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, maximum);
}

/**
 * @route GET /api/v1/profiles
 * @desc Get all scammer profiles
 */
router.get('/', async (req, res) => {
    try {
        const limit = boundedInteger(req.query.limit, 50, 100);
        if (limit === null) {
            return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        }

        const { status, minRisk } = req.query;
        const query = {};
        if (status !== undefined) {
            if (!['active', 'dormant', 'blacklisted'].includes(status)) {
                return res.status(400).json({ status: 'error', message: 'Unsupported profile status' });
            }
            query.status = status;
        }
        if (minRisk !== undefined && minRisk !== '') {
            const risk = Number(minRisk);
            if (!Number.isFinite(risk) || risk < 0 || risk > 100) {
                return res.status(400).json({ status: 'error', message: 'minRisk must be between 0 and 100' });
            }
            query.riskScore = { $gte: risk };
        }

        const profiles = await ScammerProfile.find(query)
            .sort({ riskScore: -1, lastSeen: -1 })
            .limit(limit);

        res.json({ status: 'success', data: profiles, count: profiles.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process profile request' });
    }
});

/**
 * @route GET /api/v1/profiles/:id
 * @desc Get specific profile
 */
router.get('/:id', async (req, res) => {
    try {
        if (!validIdentifier(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid profile ID' });
        const profile = await ScammerProfile.findOne({ profileId: req.params.id });

        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Profile not found' });
        }

        res.json({ status: 'success', data: profile });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process profile request' });
    }
});

/**
 * @route POST /api/v1/profiles/analyze
 * @desc Analyze session and create/update profile
 */
router.post('/analyze', async (req, res) => {
    try {
        const { sessionId } = req.body || {};

        if (!validIdentifier(sessionId)) {
            return res.status(400).json({ status: 'error', message: 'sessionId (string) required' });
        }

        const profile = await profilerService.buildProfile(sessionId);

        if (!profile) {
            return res.status(404).json({ status: 'error', message: 'Session not found or no data to profile' });
        }

        res.json({ status: 'success', data: profile });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process profile request' });
    }
});

/**
 * @route GET /api/v1/profiles/match/:id
 * @desc Find similar profiles
 */
router.get('/match/:id', async (req, res) => {
    try {
        if (!validIdentifier(req.params.id)) return res.status(400).json({ status: 'error', message: 'Invalid profile ID' });
        const limit = boundedInteger(req.query.limit, 10, 100);
        if (limit === null) return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        const matches = await profilerService.matchProfiles(req.params.id, limit);
        res.json({ status: 'success', data: matches, count: matches.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process profile request' });
    }
});

module.exports = router;
