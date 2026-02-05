// src/models/Analytics.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Analytics aggregation model
 * Stores daily/hourly metrics for dashboard visualization
 */
const analyticsSchema = new Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },

    // Core metrics
    metrics: {
        totalSessions: { type: Number, default: 0 },
        scamsDetected: { type: Number, default: 0 },
        averageConfidence: { type: Number, default: 0 },

        // Top scam types with counts
        topScamTypes: [{
            type: { type: String },
            count: { type: Number }
        }],

        // Hourly distribution (24 buckets, 0-23)
        hourlyDistribution: {
            type: [Number],
            default: () => new Array(24).fill(0)
        },

        // Language breakdown
        languageBreakdown: {
            english: { type: Number, default: 0 },
            hindi: { type: Number, default: 0 },
            hinglish: { type: Number, default: 0 },
            other: { type: Number, default: 0 }
        },

        // Quality metrics
        qualityScores: {
            avg: { type: Number, default: 0 },
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 }
        },

        // Phase distribution
        phaseDistribution: {
            early: { type: Number, default: 0 },
            mid: { type: Number, default: 0 },
            late: { type: Number, default: 0 },
            final: { type: Number, default: 0 }
        }
    },

    // Pattern trend analysis
    patternTrends: [{
        pattern: String,
        frequency: Number,
        avgConfidence: Number
    }],

    // Threat intelligence summary
    threatSummary: {
        newScammers: { type: Number, default: 0 },
        knownScammers: { type: Number, default: 0 },
        crossSessionMatches: { type: Number, default: 0 }
    },

    // Alert statistics
    alertStats: {
        totalAlerts: { type: Number, default: 0 },
        criticalAlerts: { type: Number, default: 0 },
        alertTypes: {
            type: Map,
            of: Number,
            default: new Map()
        }
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for efficient time-range queries
analyticsSchema.index({ date: -1 });

// Update timestamp on save
analyticsSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Analytics", analyticsSchema);
