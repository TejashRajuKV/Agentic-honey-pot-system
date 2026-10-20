// src/routes/language.js
const express = require('express');
const router = express.Router();
const languageService = require('../services/languageService');

function validSessionId(value) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= 200
        && !value.includes('/') && !value.includes('\\\\')
        && ![...value].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
}

/**
 * @route POST /api/v1/language/detect
 * @desc Detect language of text
 */
router.post('/detect', async (req, res) => {
    try {
        const { text } = req.body || {};

        if (typeof text !== 'string' || !text.trim() || text.length > 20000) {
            return res.status(400).json({ status: 'error', message: 'text must be a non-empty string of at most 20000 characters' });
        }

        const detection = languageService.detectLanguage(text);
        res.json({ status: 'success', data: detection });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process language request' });
    }
});

/**
 * @route GET /api/v1/language/stats/:sessionId
 * @desc Get language statistics for a session
 */
router.get('/stats/:sessionId', async (req, res) => {
    try {
        if (!validSessionId(req.params.sessionId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
        }
        const stats = await languageService.getLanguageStats(req.params.sessionId);
        res.json({ status: 'success', data: stats });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process language request' });
    }
});

/**
 * @route POST /api/v1/language/analyze-hinglish
 * @desc Analyze Hinglish text for scam patterns
 */
router.post('/analyze-hinglish', async (req, res) => {
    try {
        const { text } = req.body || {};

        if (typeof text !== 'string' || !text.trim() || text.length > 20000) {
            return res.status(400).json({ status: 'error', message: 'text must be a non-empty string of at most 20000 characters' });
        }

        const analysis = languageService.handleHinglish(text);
        res.json({ status: 'success', data: analysis });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process language request' });
    }
});

/**
 * @route GET /api/v1/language/scam-phrases
 * @desc Get common scam phrases by language
 */
router.get('/scam-phrases', async (req, res) => {
    try {
        const { language = 'english' } = req.query;
        if (typeof language !== 'string' || language.length > 40 || !/^[a-zA-Z-]+$/.test(language)) return res.status(400).json({ status: 'error', message: 'Invalid language' });
        const phrases = languageService.getCommonScamPhrases(language);
        res.json({ status: 'success', data: phrases });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Unable to process language request' });
    }
});

module.exports = router;
