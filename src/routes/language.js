// src/routes/language.js
const express = require('express');
const router = express.Router();
const languageService = require('../services/languageService');

/**
 * @route POST /api/v1/language/detect
 * @desc Detect language of text
 */
router.post('/detect', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ status: 'error', message: 'text required' });
        }

        const detection = languageService.detectLanguage(text);
        res.json({ status: 'success', data: detection });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/language/stats/:sessionId
 * @desc Get language statistics for a session
 */
router.get('/stats/:sessionId', async (req, res) => {
    try {
        const stats = await languageService.getLanguageStats(req.params.sessionId);
        res.json({ status: 'success', data: stats });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/language/analyze-hinglish
 * @desc Analyze Hinglish text for scam patterns
 */
router.post('/analyze-hinglish', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ status: 'error', message: 'text required' });
        }

        const analysis = languageService.handleHinglish(text);
        res.json({ status: 'success', data: analysis });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/language/scam-phrases
 * @desc Get common scam phrases by language
 */
router.get('/scam-phrases', async (req, res) => {
    try {
        const { language = 'english' } = req.query;
        const phrases = languageService.getCommonScamPhrases(language);
        res.json({ status: 'success', data: phrases });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
