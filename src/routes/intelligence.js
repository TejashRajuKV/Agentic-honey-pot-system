// src/routes/intelligence.js
const express = require('express');
const router = express.Router();
const threatIntel = require('../services/threatIntelService');

const MAX_IDENTIFIER_VALUES = 100;
const IDENTIFIER_LIMITS = { upiIds: 256, phoneNumbers: 64, urls: 2048 };

function parseBoundedLimit(value, fallback = 50, maximum = 100) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, maximum);
}

function validateIdentifierList(body, key) {
    const values = body[key] ?? [];
    if (!Array.isArray(values) || values.length > MAX_IDENTIFIER_VALUES) {
        return `${key} must be an array with at most ${MAX_IDENTIFIER_VALUES} items`;
    }
    if (values.some((value) => typeof value !== 'string' || value.trim().length === 0 || value.length > IDENTIFIER_LIMITS[key])) {
        return `${key} items must be non-empty strings no longer than ${IDENTIFIER_LIMITS[key]} characters`;
    }
    return null;
}

/**
 * @route GET /api/v1/intelligence/threats
 * @desc Get all known threats
 */
router.get('/threats', async (req, res) => {
    try {
        const ScammerProfile = require('../models/ScammerProfile');
        const limit = parseBoundedLimit(req.query.limit, 50, 100);
        const status = req.query.status ?? 'active';
        if (limit === null) {
            return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        }
        if (!['active', 'dormant', 'blacklisted'].includes(status)) {
            return res.status(400).json({ status: 'error', message: 'Unsupported threat status' });
        }

        const threats = await ScammerProfile.find({ status })
            .sort({ riskScore: -1, lastSeen: -1 })
            .limit(limit);

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
        const { sessionId } = req.body || {};

        if (typeof sessionId !== 'string' || !sessionId) {
            return res.status(400).json({ status: 'error', message: 'sessionId (string) required' });
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
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ status: 'error', message: 'Request body must be an object' });
        }

        for (const key of Object.keys(IDENTIFIER_LIMITS)) {
            const validationError = validateIdentifierList(body, key);
            if (validationError) {
                return res.status(400).json({ status: 'error', message: validationError });
            }
        }

        const result = await threatIntel.checkKnownThreat({
            upiIds: body.upiIds ?? [],
            phoneNumbers: body.phoneNumbers ?? [],
            urls: body.urls ?? []
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
        const limit = parseBoundedLimit(req.query.limit, 50, 100);
        if (limit === null) {
            return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        }
        const network = await threatIntel.getThreatNetwork(limit);
        res.json({ status: 'success', data: network });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
