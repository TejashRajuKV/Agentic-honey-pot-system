// agent/agentService.js

const { buildAgentPrompt } = require('./personaPrompts');
const { getConversationPhase } = require('./agentStateMachine');
const { generateRuleBasedResponse } = require('./conversationHandler');
const { shouldUseBait, generateBaitResponse, analyzeBaitResponse } = require('./baitStrategy');

// Gemini AI integration (disabled by default)
let geminiModel = null;

// Initialize Gemini if API key is available
if (process.env.LLM_API_KEY && process.env.LLM_API_KEY !== 'your_llm_api_key_here' && !process.env.LLM_API_KEY.startsWith('#')) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.LLM_API_KEY);
        geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
        console.log('✅ Gemini API initialized successfully');
    } catch (error) {
        console.warn('⚠️  Gemini API initialization failed:', error.message);
        console.warn('   Falling back to rule-based responses');
    }
}

/**
 * AI Agent Service with Level 5 Bait Strategy
 * Manages AI-powered autonomous conversation with strategic confusion
 */

/**
 * Generate AI agent response with bait strategy
 * @param {string} userMessage - The latest message from the scammer
 * @param {Array} conversationHistory - Previous conversation turns
 * @param {Object} scamContext - Information about detected scam type and patterns
 * @param {Object} sessionData - Session metadata (for tracking bait)
 * @returns {Object} - AI-generated response with metadata
 */
async function generateAgentResponse(userMessage, conversationHistory = [], scamContext = {}, sessionData = {}) {
    const { categories = [], confidence = 0, riskLevel = 'SAFE' } = scamContext;

    // Determine the conversation context and phase
    const turnCount = conversationHistory.length;
    const phase = getConversationPhase(turnCount);

    // LEVEL 5: Check if we should use bait strategy
    const useBait = shouldUseBait({ confidence, riskLevel }, phase, turnCount);

    let response;
    let metadata = {
        usedBait: false,
        baitType: null,
        baitAnalysis: null
    };

    if (useBait) {
        // Use strategic bait response
        const bait = generateBaitResponse(userMessage, scamContext, phase);
        response = bait.response;
        metadata.usedBait = true;
        metadata.baitType = bait.baitType;

        console.log(`🎣 Using bait strategy: ${bait.baitType}`);

        // Analyze previous turn if we used bait before
        if (sessionData.lastBaitType && conversationHistory.length > 0) {
            const prevUserMsg = conversationHistory
                .filter(h => h.role === 'user')
                .slice(-1)[0];

            if (prevUserMsg) {
                const analysis = analyzeBaitResponse(prevUserMsg.text, sessionData.lastBaitType);
                metadata.baitAnalysis = analysis;

                if (analysis.triggeredReveal) {
                    console.log(`🎯 Bait successful! Scammer revealed: ${analysis.patterns.join(', ')}`);
                }
            }
        }
    } else {
        // Standard engagement (no bait)

        // Try Gemini API first if available
        if (geminiModel) {
            try {
                const prompt = buildAgentPrompt(userMessage, conversationHistory, phase, categories);

                const result = await geminiModel.generateContent(prompt);
                const geminiResponse = result.response;
                const text = geminiResponse.text();

                // Ensure response is not too long and natural
                response = text
                    .trim()
                    .replace(/^(Agent:|Response:|Reply:)\s*/i, '') // Remove any prefix
                    .substring(0, 200); // Limit length

                console.log(`🤖 Gemini response (${phase} phase)`);

            } catch (error) {
                console.error('❌ Gemini API error:', error.message);
                console.log('   Falling back to rule-based response');
                response = generateRuleBasedResponse(userMessage, phase, categories);
            }
        } else {
            // Rule-based fallback responses
            response = generateRuleBasedResponse(userMessage, phase, categories);
        }
    }

    return {
        response,
        metadata
    };
}

module.exports = {
    generateAgentResponse
};
