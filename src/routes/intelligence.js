// src/routes/intelligence.js
const express = require('express');
const router = express.Router();
const threatIntel = require('../services/threatIntelService');

/**
 * @route GET /api/v1/intelligence/threats
 * @desc Get all known threats
 */
router.get('/threats', async (req, res) => {
    try {
        const ScammerProfile = require('../models/ScammerProfile');
        const { limit = 50, status = 'active' } = req.query;

        const threats = await ScammerProfile.find({ status })
            .sort({ riskScore: -1, lastSeen: -1 })
            .limit(parseInt(limit));

        res.json({ status: 'success', data: threats, count: threats.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/intelligence/profile/:id
 * @desc Get specific threat profile
 */
router.get('/profile/:id', async (req, res) => {
    try {
        const report = await threatIntel.generateThreatReport(req.params.id);

        if (!report) {
            return res.status(404).json({ status: 'error', message: 'Profile not found' });
        }

        res.json({ status: 'success', data: report });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/intelligence/correlate
 * @desc Find related sessions
 */
router.post('/correlate', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ status: 'error', message: 'sessionId required' });
        }

        const correlation = await threatIntel.correlateSessions(sessionId);
        res.json({ status: 'success', data: correlation });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/intelligence/check
 * @desc Check if identifiers are known threats
 */
router.post('/check', async (req, res) => {
    try {
        const { upiIds, phoneNumbers, urls } = req.body;

        const result = await threatIntel.checkKnownThreat({
            upiIds: upiIds || [],
            phoneNumbers: phoneNumbers || [],
            urls: urls || []
        });

        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/intelligence/network
 * @desc Get threat network graph
 */
router.get('/network', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const network = await threatIntel.getThreatNetwork(parseInt(limit));
        res.json({ status: 'success', data: network });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
