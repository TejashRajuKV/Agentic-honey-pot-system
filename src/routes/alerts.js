// src/routes/alerts.js
const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const AlertConfig = require('../models/AlertConfig');

/**
 * @route GET /api/v1/alerts/config
 * @desc Get alert configuration
 */
router.get('/config', async (req, res) => {
    try {
        let config = await AlertConfig.findOne();

        if (!config) {
            config = await AlertConfig.create({});
        }

        res.json({ status: 'success', data: config });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route PUT /api/v1/alerts/config
 * @desc Update alert configuration
 */
router.put('/config', async (req, res) => {
    try {
        let config = await AlertConfig.findOne();

        if (!config) {
            config = new AlertConfig(req.body);
        } else {
            Object.assign(config, req.body);
        }

        await config.save();

        res.json({ status: 'success', data: config, message: 'Configuration updated' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route POST /api/v1/alerts/test
 * @desc Test webhook configuration
 */
router.post('/test', async (req, res) => {
    try {
        const { webhookUrl, auth } = req.body;

        if (!webhookUrl) {
            return res.status(400).json({ status: 'error', message: 'webhookUrl required' });
        }

        const result = await alertService.testWebhook(webhookUrl, auth);
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/alerts/history
 * @desc Get alert history
 */
router.get('/history', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const history = await alertService.getAlertHistory(parseInt(limit));
        res.json({ status: 'success', data: history, count: history.length });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/alerts/stats
 * @desc Get alert statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await alertService.getAlertStats();
        res.json({ status: 'success', data: stats });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
