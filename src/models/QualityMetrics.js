// src/models/QualityMetrics.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Conversation quality metrics model
 * Tracks response quality for continuous improvement
 */
const qualityMetricsSchema = new Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },

    turnNumber: {
        type: Number,
        required: true
    },

    // Multi-dimensional quality scoring
    scores: {
        // How natural/human-like the response is
        naturalness: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // Logical consistency with conversation history
        coherence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // Relevance to scammer's message
        relevance: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // Strategic value (info extraction, time wasting)
        strategicValue: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        },

        // Overall weighted score
        overall: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.5
        }
    },

    // Quality flags/issues detected
    flags: [{
        type: {
            type: String,
            enum: [
                'repetitive',
                'off_topic',
                'too_eager',
                'unrealistic',
                'inconsistent',
                'too_suspicious',
                'poor_grammar',
                'out_of_character'
            ]
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high']
        },
        description: String
    }],

    // Detailed analysis
    analysis: {
        // Message being scored
        agentMessage: String,
        scammerMessage: String,

        // Context factors
        phaseAtTime: String,
        riskAtTime: Number,
        emotionAtTime: String,

        // Scoring breakdown
        breakdown: {
            // Naturalness factors
            hasTypos: Boolean,
            usesColloquialisms: Boolean,
            appropriateLength: Boolean,

            // Coherence factors
            referencesHistory: Boolean,
            maintainsPersona: Boolean,
            logicalFlow: Boolean,

            // Relevance factors
            addressesQuestion: Boolean,
            staysOnTopic: Boolean,

            // Strategic factors
            extractsInfo: Boolean,
            createsDelay: Boolean,
            buildsRapport: Boolean
        }
    },

    // Comparative metrics
    comparison: {
        // How this compares to session average
        vsSessionAvg: Number,

        // How this compares to global average
        vsGlobalAvg: Number,

        // Trend (improving/declining)
        trend: {
            type: String,
            enum: ['improving', 'stable', 'declining']
        }
    },

    // Metadata
    timestamp: { type: Date, default: Date.now },
    evaluatedBy: {
        type: String,
        enum: ['llm', 'rule_based', 'hybrid'],
        default: 'rule_based'
    }
});

// Compound index for efficient session queries
qualityMetricsSchema.index({ sessionId: 1, turnNumber: 1 });
qualityMetricsSchema.index({ timestamp: -1 });
qualityMetricsSchema.index({ 'scores.overall': -1 });

module.exports = mongoose.model("QualityMetrics", qualityMetricsSchema);
