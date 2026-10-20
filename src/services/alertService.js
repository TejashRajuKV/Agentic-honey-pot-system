// src/services/alertService.js
const crypto = require('crypto');
const AlertConfig = require('../models/AlertConfig');
const { validateWebhookUrl, requestValidatedWebhook } = require('../utils/webhookUrlPolicy');
// Uses Node's built-in fetch (node-fetch v3 is ESM-only and cannot be require()d)

/**
 * Alert Service
 * Manages webhook notifications and alert dispatch
 */
class AlertService {
    constructor() {
        this.rateLimitCache = new Map(); // Track alert rates
    }

    /**
     * Send alert based on event type
     */
    async sendAlert(type, payload) {
        // Get alert configuration
        let config = await AlertConfig.findOne();

        if (!config) {
            // Create default configuration
            config = await AlertConfig.create({
                enabled: true,
                triggers: {
                    criticalRisk: { type: Boolean, default: true, threshold: 80 },
                    newScammer: { type: Boolean, default: true },
                    crossSessionMatch: { type: Boolean, default: true, minSessions: 3 },
                    qualityDrop: { type: Boolean, default: false, threshold: 0.5 },
                    highVelocityAttack: { type: Boolean, default: true },
                    multipleVictims: { type: Boolean, default: true, threshold: 5 }
                },
                channels: ['webhook', 'log']
            });
        }

        if (!config.enabled) {
            return { sent: false, reason: 'alerts_disabled' };
        }

        // Check if this alert type is enabled
        const triggerKey = this._getTriggerKey(type);
        if (!config.triggers[triggerKey]) {
            return { sent: false, reason: 'trigger_not_enabled' };
        }

        // Configured filters (minimum risk, scam-type allow-list)
        const minRisk = config.filters?.minRiskScore || 0;
        if (minRisk > 0 && typeof payload.riskScore === 'number' && payload.riskScore < minRisk) {
            return { sent: false, reason: 'below_min_risk_score' };
        }
        const allowedTypes = config.filters?.scamTypes || [];
        if (allowedTypes.length && payload.scamType && !allowedTypes.includes(payload.scamType)) {
            return { sent: false, reason: 'scam_type_filtered' };
        }

        // Check rate limits
        if (!this._checkRateLimit(config)) {
            return { sent: false, reason: 'rate_limit_exceeded' };
        }

        // Format payload
        const alertPayload = this.formatWebhookPayload(type, payload);

        const results = {
            type,
            sent: false,
            channels: {},
            timestamp: new Date()
        };

        // Send to each enabled channel
        for (const channel of config.channels) {
            try {
                if (channel === 'webhook' && config.webhookUrl) {
                    const webhookResult = await this._sendWebhook(config, alertPayload);
                    results.channels.webhook = webhookResult;
                    results.sent = results.sent || webhookResult.success;
                    config.stats.retries = (config.stats.retries || 0) + (webhookResult.retries || 0);
                    if (webhookResult.latencyMs != null) {
                        config.stats.latencySamples = [...(config.stats.latencySamples || []), webhookResult.latencyMs].slice(-50);
                    }
                    if (!webhookResult.success) config.stats.deadLetters = (config.stats.deadLetters || 0) + 1;
                } else if (channel === 'log') {
                    this._logAlert(type, alertPayload);
                    results.channels.log = { success: true };
                    results.sent = true;
                } else if (channel === 'database') {
                    // Alert is automatically saved to history
                    results.channels.database = { success: true };
                    results.sent = true;
                }
            } catch (error) {
                results.channels[channel] = { success: false, error: error.message };
            }
        }

        // Save to history
        config.history.push({
            type,
            sessionId: payload.sessionId,
            profileId: payload.profileId,
            timestamp: new Date(),
            payload: alertPayload,
            delivered: results.sent,
            deliveryError: results.sent ? null : 'Failed to deliver'
        });

        // Update stats
        config.stats.totalAlertsSent++;
        if (results.sent) {
            config.stats.successfulDeliveries++;
            config.stats.lastSuccessfulDelivery = new Date();
        } else {
            config.stats.failedDeliveries++;
            config.stats.lastFailure = new Date();
        }
        config.stats.lastAlertSent = new Date();

        await config.save();

        return results;
    }

    /**
     * Get trigger key from alert type
     */
    _getTriggerKey(type) {
        const typeMap = {
            'critical_risk': 'criticalRisk',
            'new_scammer': 'newScammer',
            'cross_session': 'crossSessionMatch',
            'quality_drop': 'qualityDrop',
            'high_velocity': 'highVelocityAttack',
            'multiple_victims': 'multipleVictims'
        };
        return typeMap[type] || type;
    }

    /**
     * Check if rate limit allows sending
     */
    _checkRateLimit(config) {
        const rateLimit = config?.filters?.rateLimit;
        if (rateLimit?.enabled === false) return true;

        const maxPerHour = Number.isInteger(rateLimit?.maxAlertsPerHour) && rateLimit.maxAlertsPerHour > 0
            ? rateLimit.maxAlertsPerHour : 10;
        const maxPerDay = Number.isInteger(rateLimit?.maxAlertsPerDay) && rateLimit.maxAlertsPerDay > 0
            ? rateLimit.maxAlertsPerDay : 50;
        const history = Array.isArray(config?.history) ? config.history : [];
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        const dayAgo = now - (24 * 60 * 60 * 1000);

        // Ignore invalid timestamps in legacy/corrupt history instead of crashing dispatch.
        const recentAlerts = history.filter((alert) => {
            const timestamp = new Date(alert?.timestamp).getTime();
            return Number.isFinite(timestamp) && timestamp > dayAgo;
        });
        const lastHourAlerts = recentAlerts.filter((alert) =>
            new Date(alert.timestamp).getTime() > hourAgo
        );

        return lastHourAlerts.length < maxPerHour && recentAlerts.length < maxPerDay;
    }

    /**
     * Send webhook notification
     */
    async _sendWebhook(config, payload, retryCount = 0) {
        const started = Date.now();
        try {
            const body = JSON.stringify(payload);
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Honeypot-Alert-System/1.0'
            };

            // Add authentication if configured
            if (config.auth?.type === 'bearer') {
                headers['Authorization'] = `Bearer ${config.auth.token}`;
            } else if (config.auth?.type === 'api_key') {
                headers[config.auth.headerName || 'X-API-Key'] = config.auth.token;
            } else if (config.auth?.type === 'basic') {
                headers['Authorization'] = `Basic ${Buffer.from(config.auth.token).toString('base64')}`;
            } else if (config.auth?.type === 'hmac' && config.auth.token) {
                // Receiver verifies: HMAC-SHA256(secret, `${timestamp}.${rawBody}`) — replay-safe with a timestamp window
                const timestamp = Math.floor(Date.now() / 1000).toString();
                const signature = crypto.createHmac('sha256', config.auth.token).update(`${timestamp}.${body}`).digest('hex');
                headers['X-CyberRakshak-Timestamp'] = timestamp;
                headers['X-CyberRakshak-Signature'] = `sha256=${signature}`;
            }

            // The request helper pins the socket lookup to the validated public DNS answer.
            const response = await requestValidatedWebhook(config.webhookUrl, {
                method: 'POST', headers, body, timeoutMs: 10000
            });

            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
            }

            return {
                success: true,
                statusCode: response.status,
                latencyMs: Date.now() - started,
                retries: retryCount,
                timestamp: new Date()
            };

        } catch (error) {
            // Retry logic
            const destinationRejected = /Webhook URL|hostname|HTTPS|credentials|IP address|resolve/i.test(error.message);
            if (!destinationRejected && config.retryConfig?.enabled && retryCount < (config.retryConfig.maxRetries || 0)) {
                await new Promise(resolve => setTimeout(resolve, config.retryConfig.retryDelay));
                return this._sendWebhook(config, payload, retryCount + 1);
            }

            return {
                success: false,
                error: error.message,
                latencyMs: Date.now() - started,
                retries: retryCount
            };
        }
    }

    /**
     * Log alert to console/file
     */
    _logAlert(type, payload) {
        const timestamp = new Date().toISOString();
        console.log(`[ALERT ${timestamp}] Type: ${type}`);
        console.log(`  Session: ${payload.sessionId || 'N/A'}`);
        console.log(`  Risk: ${payload.riskScore || 'N/A'}/100`);
        console.log(`  Details:`, JSON.stringify(payload, null, 2));
    }

    /**
     * Format webhook payload
     */
    formatWebhookPayload(eventType, data) {
        const basePayload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            system: 'honeypot-alert-system',
            version: '2.1'
        };

        switch (eventType) {
            case 'critical_risk':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'CRITICAL',
                        title: 'Critical Scam Risk Detected',
                        message: `Session ${data.sessionId} has reached critical risk level`,
                        riskScore: data.riskScore,
                        sessionId: data.sessionId,
                        scamType: data.scamType,
                        patterns: data.patterns,
                        intelligence: data.intelligence
                    }
                };

            case 'new_scammer':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'MEDIUM',
                        title: 'New Scammer Profile Created',
                        message: `New threat actor identified: ${data.profileId}`,
                        profileId: data.profileId,
                        riskScore: data.riskScore,
                        identifiers: data.identifiers,
                        tactics: data.tactics
                    }
                };

            case 'cross_session':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'HIGH',
                        title: 'Cross-Session Threat Match',
                        message: data.incidentId
                            ? `Incident ${data.incidentId} has now spread to ${data.sessions?.length || data.matchCount || 2} sessions`
                            : `Scammer identified across ${data.matchCount || data.sessions?.length || 2} sessions`,
                        incidentId: data.incidentId,
                        profileId: data.profileId,
                        riskScore: data.riskScore,
                        scamType: data.scamType,
                        matchCount: data.matchCount ?? data.sessions?.length,
                        sessions: data.sessions,
                        sharedIdentifiers: data.sharedIdentifiers,
                        identifiers: data.identifiers
                    }
                };

            case 'quality_drop':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'LOW',
                        title: 'Agent Quality Decline',
                        message: `Quality score dropped below threshold`,
                        sessionId: data.sessionId,
                        qualityScore: data.qualityScore,
                        threshold: data.threshold
                    }
                };

            case 'high_velocity':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'HIGH',
                        title: 'High-Velocity Attack Detected',
                        message: `Rapid scam escalation detected in session ${data.sessionId}`,
                        sessionId: data.sessionId,
                        velocity: data.velocity,
                        turnCount: data.turnCount,
                        timeElapsed: data.timeElapsed
                    }
                };



            case 'multiple_victims':
                return {
                    ...basePayload,
                    alert: {
                        severity: 'HIGH',
                        title: 'Multiple Victim Targeting',
                        message: `Scammer ${data.profileId} has targeted ${data.victimCount} victims`,
                        profileId: data.profileId,
                        victimCount: data.victimCount,
                        timeframe: data.timeframe
                    }
                };

            default:
                return {
                    ...basePayload,
                    alert: {
                        severity: 'INFO',
                        title: 'Alert',
                        message: 'Alert triggered',
                        data
                    }
                };
        }
    }

    /**
     * Check if alert should trigger based on session state
     */
    async checkTriggers(sessionData) {
        const alerts = [];
        const config = await AlertConfig.findOne();

        if (!config || !config.enabled) {
            return alerts;
        }

        // Critical Risk
        if (config.triggers.criticalRisk &&
            sessionData.scamProbability >= (config.triggers.criticalRisk.threshold || 80)) {
            alerts.push({
                type: 'critical_risk',
                payload: {
                    sessionId: sessionData.sessionId,
                    riskScore: sessionData.scamProbability,
                    scamType: sessionData.scamType,
                    patterns: sessionData.patterns,
                    intelligence: sessionData.intelligence
                }
            });
        }

        // High Velocity Attack
        if (config.triggers.highVelocityAttack && sessionData.pressureVelocity === 'fast') {
            alerts.push({
                type: 'high_velocity',
                payload: {
                    sessionId: sessionData.sessionId,
                    velocity: sessionData.pressureVelocity,
                    turnCount: sessionData.turnCount,
                    timeElapsed: sessionData.timeElapsed
                }
            });
        }

        return alerts;
    }

    /**
     * Test webhook configuration
     */
    async testWebhook(webhookUrl, authConfig = null) {
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            system: 'honeypot-alert-system',
            alert: {
                severity: 'INFO',
                title: 'Test Alert',
                message: 'This is a test webhook notification'
            }
        };

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (authConfig) {
                if (authConfig.type === 'bearer') {
                    headers['Authorization'] = `Bearer ${authConfig.token}`;
                } else if (authConfig.type === 'api_key') {
                    headers[authConfig.headerName || 'X-API-Key'] = authConfig.token;
                } else if (authConfig.type === 'basic') {
                    headers['Authorization'] = `Basic ${Buffer.from(authConfig.token || '').toString('base64')}`;
                } else if (authConfig.type === 'hmac' && authConfig.token) {
                    const timestamp = Math.floor(Date.now() / 1000).toString();
                    headers['X-CyberRakshak-Timestamp'] = timestamp;
                    headers['X-CyberRakshak-Signature'] = `sha256=${crypto.createHmac('sha256', authConfig.token).update(`${timestamp}.${JSON.stringify(testPayload)}`).digest('hex')}`;
                }
            }

            const response = await requestValidatedWebhook(webhookUrl, {
                method: 'POST', headers, body: JSON.stringify(testPayload), timeoutMs: 5000
            });

            return {
                success: response.ok,
                statusCode: response.status,
                statusText: response.statusText,
                message: response.ok ? 'Webhook test successful' : 'Webhook test failed'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to connect to webhook URL'
            };
        }
    }

    /**
     * Get alert history
     */
    async getAlertHistory(limit = 50) {
        const config = await AlertConfig.findOne();
        if (!config) {
            return [];
        }

        return config.history
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    /**
     * Get alert statistics
     */
    async getAlertStats() {
        const config = await AlertConfig.findOne();
        if (!config) {
            return {
                totalAlerts: 0,
                successRate: 0,
                avgAlertsPerDay: 0
            };
        }

        const stats = config.stats;
        const successRate = stats.totalAlertsSent > 0
            ? (stats.successfulDeliveries / stats.totalAlertsSent * 100).toFixed(1)
            : 0;

        // Calculate average alerts per day
        const last30Days = config.history.filter(a =>
            new Date(a.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        const avgAlertsPerDay = (last30Days.length / 30).toFixed(1);

        return {
            total: stats.totalAlertsSent,
            successful: stats.successfulDeliveries,
            failed: stats.failedDeliveries,
            retries: stats.retries || 0,
            deadLetters: stats.deadLetters || 0,
            latency: (() => {
                const v = [...(stats.latencySamples || [])].sort((a, b) => a - b);
                if (!v.length) return null;
                const pick = (p) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
                return { samples: v.length, avgMs: Math.round(v.reduce((a, b) => a + b, 0) / v.length), p50Ms: pick(0.5), p95Ms: pick(0.95) };
            })(),
            successRate: parseFloat(successRate),
            avgAlertsPerDay: parseFloat(avgAlertsPerDay),
            lastAlert: stats.lastAlertSent,
            lastSuccess: stats.lastSuccessfulDelivery,
            lastFailure: stats.lastFailure
        };
    }
}

module.exports = new AlertService();
