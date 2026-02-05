// src/models/AlertConfig.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Alert configuration and history model
 * Manages webhook configurations and alert dispatch
 */
const alertConfigSchema = new Schema({
    // Webhook configuration
    webhookUrl: {
        type: String,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'Invalid webhook URL format'
        }
    },

    enabled: {
        type: Boolean,
        default: true
    },

    // Trigger conditions
    triggers: {
        criticalRisk: {
            type: Boolean,
            default: true,
            threshold: { type: Number, default: 80 } // Risk score threshold
        },

        newScammer: {
            type: Boolean,
            default: true
        },

        crossSessionMatch: {
            type: Boolean,
            default: true,
            minSessions: { type: Number, default: 3 } // Alert if scammer seen in N+ sessions
        },

        qualityDrop: {
            type: Boolean,
            default: false,
            threshold: { type: Number, default: 0.5 } // Quality score threshold
        },

        highVelocityAttack: {
            type: Boolean,
            default: true
        },

        multipleVictims: {
            type: Boolean,
            default: true,
            threshold: { type: Number, default: 5 } // Alert if scammer targets N+ victims
        }
    },

    // Delivery channels
    channels: {
        type: [String],
        enum: ['webhook', 'email', 'log', 'database'],
        default: ['webhook', 'log']
    },

    // Filtering and rate limiting
    filters: {
        minRiskScore: { type: Number, default: 0 },
        platforms: [String], // Only alert for specific platforms
        scamTypes: [String], // Only alert for specific scam types

        // Rate limiting
        rateLimit: {
            enabled: { type: Boolean, default: true },
            maxAlertsPerHour: { type: Number, default: 10 },
            maxAlertsPerDay: { type: Number, default: 50 }
        }
    },

    // Alert history (last N alerts)
    history: [{
        type: {
            type: String,
            enum: ['critical_risk', 'new_scammer', 'cross_session', 'quality_drop', 'high_velocity', 'multiple_victims']
        },
        sessionId: String,
        profileId: String,
        timestamp: Date,
        payload: Schema.Types.Mixed,
        delivered: Boolean,
        deliveryError: String
    }],

    // Webhook authentication
    auth: {
        type: {
            type: String,
            enum: ['none', 'bearer', 'api_key', 'basic'],
            default: 'none'
        },
        token: String,
        headerName: String
    },

    // Retry configuration
    retryConfig: {
        enabled: { type: Boolean, default: true },
        maxRetries: { type: Number, default: 3 },
        retryDelay: { type: Number, default: 5000 } // ms
    },

    // Statistics
    stats: {
        totalAlertsSent: { type: Number, default: 0 },
        successfulDeliveries: { type: Number, default: 0 },
        failedDeliveries: { type: Number, default: 0 },
        lastAlertSent: Date,
        lastSuccessfulDelivery: Date,
        lastFailure: Date
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Limit history to last 100 alerts
alertConfigSchema.pre('save', function (next) {
    if (this.history && this.history.length > 100) {
        this.history = this.history.slice(-100);
    }
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("AlertConfig", alertConfigSchema);
