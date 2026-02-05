// src/services/alertService.js
const AlertConfig = require('../models/AlertConfig');
const fetch = require('node-fetch');

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
        if (!config.filters.rateLimit.enabled) {
            return true;
        }

        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        const dayAgo = now - (24 * 60 * 60 * 1000);

        // Clean old entries
        const recentAlerts = config.history.filter(a =>
            new Date(a.timestamp).getTime() > dayAgo
        );

        const lastHourAlerts = recentAlerts.filter(a =>
            new Date(a.timestamp).getTime() > hourAgo
        );

        // Check hourly limit
        if (lastHourAlerts.length >= config.filters.rateLimit.maxAlertsPerHour) {
            return false;
        }

        // Check daily limit
        if (recentAlerts.length >= config.filters.rateLimit.maxAlertsPerDay) {
            return false;
        }

        return true;
    }

    /**
     * Send webhook notification
     */
    async _sendWebhook(config, payload, retryCount = 0) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Honeypot-Alert-System/1.0'
            };

            // Add authentication if configured
            if (config.auth.type === 'bearer') {
                headers['Authorization'] = `Bearer ${config.auth.token}`;
            } else if (config.auth.type === 'api_key') {
                headers[config.auth.headerName || 'X-API-Key'] = config.auth.token;
            } else if (config.auth.type === 'basic') {
                headers['Authorization'] = `Basic ${Buffer.from(config.auth.token).toString('base64')}`;
            }

            const response = await fetch(config.webhookUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                timeout: 10000 // 10 second timeout
            });

            if (!response.ok) {
                throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
            }

            return {
                success: true,
                statusCode: response.status,
                timestamp: new Date()
            };

        } catch (error) {
            // Retry logic
            if (config.retryConfig.enabled && retryCount < config.retryConfig.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, config.retryConfig.retryDelay));
                return this._sendWebhook(config, payload, retryCount + 1);
            }

            return {
                success: false,
                error: error.message,
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
                        message: `Scammer identified across ${data.matchCount} sessions`,
                        profileId: data.profileId,
                        matchCount: data.matchCount,
                        sessions: data.sessions,
                        sharedIdentifiers: data.sharedIdentifiers
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
                }
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(testPayload),
                timeout: 5000
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
            successRate: parseFloat(successRate),
            avgAlertsPerDay: parseFloat(avgAlertsPerDay),
            lastAlert: stats.lastAlertSent,
            lastSuccess: stats.lastSuccessfulDelivery,
            lastFailure: stats.lastFailure
        };
    }
}

module.exports = new AlertService();
