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

    // Alert history is served by /history. Do not duplicate potentially sensitive
    // extracted indicators and webhook payloads in the general configuration response.
    delete data.history;
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
        res.status(500).json({ status: 'error', message: 'Unable to load alert configuration' });
    }
});

/**
 * @route PUT /api/v1/alerts/config
 * @desc Update alert configuration
 */
router.put('/config', async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ status: 'error', message: 'Request body must be a JSON object' });
        }
        if (body.webhookUrl !== undefined && typeof body.webhookUrl !== 'string') {
            return res.status(400).json({ status: 'error', message: 'webhookUrl must be a string' });
        }
        if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
            return res.status(400).json({ status: 'error', message: 'enabled must be a boolean' });
        }
        const allowedChannels = ['webhook', 'email', 'log', 'database'];
        if (body.channels !== undefined &&
            (!Array.isArray(body.channels) || body.channels.some((channel) => !allowedChannels.includes(channel)))) {
            return res.status(400).json({ status: 'error', message: 'channels must be an array containing only webhook, email, log, or database' });
        }
        for (const field of ['triggers', 'filters', 'auth', 'retryConfig']) {
            if (body[field] !== undefined && (!body[field] || typeof body[field] !== 'object' || Array.isArray(body[field]))) {
                return res.status(400).json({ status: 'error', message: `${field} must be an object` });
            }
        }
        const triggerFields = ['criticalRisk', 'newScammer', 'crossSessionMatch', 'qualityDrop', 'highVelocityAttack', 'multipleVictims'];
        if (body.triggers !== undefined) {
            for (const field of triggerFields) {
                if (body.triggers[field] !== undefined && typeof body.triggers[field] !== 'boolean') {
                    return res.status(400).json({ status: 'error', message: `triggers.${field} must be a boolean` });
                }
            }
        }
        if (body.filters?.rateLimit !== undefined &&
            (!body.filters.rateLimit || typeof body.filters.rateLimit !== 'object' || Array.isArray(body.filters.rateLimit))) {
            return res.status(400).json({ status: 'error', message: 'filters.rateLimit must be an object' });
        }
        if (body.auth?.type !== undefined && !['none', 'bearer', 'api_key', 'basic', 'hmac'].includes(body.auth.type)) {
            return res.status(400).json({ status: 'error', message: 'auth.type is not supported' });
        }
        if (body.auth?.token !== undefined && typeof body.auth.token !== 'string') {
            return res.status(400).json({ status: 'error', message: 'auth.token must be a string' });
        }
        if (body.auth?.headerName !== undefined &&
            (typeof body.auth.headerName !== 'string' || body.auth.headerName.length > 100 ||
             !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(body.auth.headerName))) {
            return res.status(400).json({ status: 'error', message: 'auth.headerName must be a valid HTTP header name of at most 100 characters' });
        }

        // Bound numeric controls to prevent accidental or hostile resource exhaustion.
        const numericRules = [
            ['filters.minRiskScore', body.filters?.minRiskScore, 0, 100],
            ['filters.rateLimit.maxAlertsPerHour', body.filters?.rateLimit?.maxAlertsPerHour, 1, 10000],
            ['filters.rateLimit.maxAlertsPerDay', body.filters?.rateLimit?.maxAlertsPerDay, 1, 100000],
            ['retryConfig.maxRetries', body.retryConfig?.maxRetries, 0, 10],
            ['retryConfig.retryDelay', body.retryConfig?.retryDelay, 100, 60000],
        ];
        for (const [field, value, min, max] of numericRules) {
            if (value !== undefined && (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max)) {
                return res.status(400).json({ status: 'error', message: `${field} must be an integer between ${min} and ${max}` });
            }
        }
        for (const [field, value] of [
            ['filters.rateLimit.enabled', body.filters?.rateLimit?.enabled],
            ['retryConfig.enabled', body.retryConfig?.enabled],
        ]) {
            if (value !== undefined && typeof value !== 'boolean') {
                return res.status(400).json({ status: 'error', message: `${field} must be a boolean` });
            }
        }
        for (const [field, value] of [
            ['filters.platforms', body.filters?.platforms],
            ['filters.scamTypes', body.filters?.scamTypes],
        ]) {
            if (value !== undefined && (!Array.isArray(value) || value.length > 100 ||
                value.some((item) => typeof item !== 'string' || item.length > 100))) {
                return res.status(400).json({ status: 'error', message: `${field} must be an array of at most 100 strings (each at most 100 characters)` });
            }
        }
        if (body.webhookUrl) await validateWebhookUrl(body.webhookUrl);

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
        res.status(isValidationError ? 400 : 500).json({ status: 'error', message: isValidationError ? error.message : 'Unable to update alert configuration' });
    }
});

/**
 * @route POST /api/v1/alerts/test
 * @desc Test webhook configuration
 */
router.post('/test', async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return res.status(400).json({ status: 'error', message: 'Request body must be a JSON object' });
        }
        const { webhookUrl, auth } = body;

        if (typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
            return res.status(400).json({ status: 'error', message: 'webhookUrl must be a non-empty string' });
        }
        if (auth !== undefined && (!auth || typeof auth !== 'object' || Array.isArray(auth))) {
            return res.status(400).json({ status: 'error', message: 'auth must be an object' });
        }
        if (auth?.type !== undefined && !['none', 'bearer', 'api_key', 'basic', 'hmac'].includes(auth.type)) {
            return res.status(400).json({ status: 'error', message: 'auth.type is not supported' });
        }
        if (auth?.token !== undefined && typeof auth.token !== 'string') {
            return res.status(400).json({ status: 'error', message: 'auth.token must be a string' });
        }
        if (auth?.headerName !== undefined &&
            (typeof auth.headerName !== 'string' || auth.headerName.length > 100 ||
             !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(auth.headerName))) {
            return res.status(400).json({ status: 'error', message: 'auth.headerName must be a valid HTTP header name of at most 100 characters' });
        }
        await validateWebhookUrl(webhookUrl);

        const result = await alertService.testWebhook(webhookUrl, auth);
        res.json({ status: 'success', data: result });
    } catch (error) {
        const isValidationError = /Webhook URL|hostname|HTTPS|credentials|IP address|resolve/i.test(error.message);
        res.status(isValidationError ? 400 : 500).json({ status: isValidationError ? 'error' : 'error', message: isValidationError ? error.message : 'Webhook test failed' });
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
        res.status(500).json({ status: 'error', message: 'Unable to load alert history' });
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
        res.status(500).json({ status: 'error', message: 'Unable to load alert statistics' });
    }
});

module.exports = router;
