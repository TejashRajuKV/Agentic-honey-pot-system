// src/routes/alerts.js
const express = require('express');
const router = express.Router();
const alertService = require('../services/alertService');
const AlertConfig = require('../models/AlertConfig');
const { validateWebhookUrl } = require('../utils/webhookUrlPolicy');

function boundedAlertLimit(value) {
    if (value === undefined || value === '') return 50;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, 100);
}

function safeConfigResponse(config) {
    const data = config.toObject ? config.toObject() : { ...config };
    if (data.auth) data.auth = { ...data.auth, token: data.auth.token ? '••••••••' : '' };
    return data;
}

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

        res.json({ status: 'success', data: safeConfigResponse(config) });
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
        if (req.body?.webhookUrl) await validateWebhookUrl(req.body.webhookUrl);

        // Only accept documented configuration fields; do not allow clients to overwrite history/stats.
        const allowedFields = ['webhookUrl', 'enabled', 'triggers', 'channels', 'filters', 'auth', 'retryConfig'];
        const updates = Object.fromEntries(allowedFields
            .filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key))
            .map((key) => [key, req.body[key]]));

        let config = await AlertConfig.findOne();

        // The UI receives a masked token; preserve the stored secret when it sends that mask back.
        if (updates.auth?.token === '••••••••') {
            updates.auth = { ...updates.auth, token: config?.auth?.token || '' };
        }

        if (!config) {
            config = new AlertConfig(updates);
        } else {
            Object.assign(config, updates);
        }

        await config.save();

        res.json({ status: 'success', data: safeConfigResponse(config), message: 'Configuration updated' });
    } catch (error) {
        const isValidationError = /Webhook URL|hostname|HTTPS|credentials|IP address|resolve/i.test(error.message);
        res.status(isValidationError ? 400 : 500).json({ status: 'error', message: error.message });
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
        await validateWebhookUrl(webhookUrl);

        const result = await alertService.testWebhook(webhookUrl, auth);
        res.json({ status: 'success', data: result });
    } catch (error) {
        const isValidationError = /Webhook URL|hostname|HTTPS|credentials|IP address|resolve/i.test(error.message);
        res.status(isValidationError ? 400 : 500).json({ status: 'error', message: error.message });
    }
});

/**
 * @route GET /api/v1/alerts/history
 * @desc Get alert history
 */
router.get('/history', async (req, res) => {
    try {
        const limit = boundedAlertLimit(req.query.limit);
        if (limit === null) return res.status(400).json({ status: 'error', message: 'limit must be a positive integer' });
        const history = await alertService.getAlertHistory(limit);
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
