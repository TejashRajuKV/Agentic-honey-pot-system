// agent/agentService.js

const { buildAgentPrompt } = require('./personaPrompts');
const { getConversationPhase, updateAgentState, AGENT_STATES } = require('./agentStateMachine');
const { generateRuleBasedResponse, generateEmotionAwareResponse } = require('./conversationHandler');
const { shouldUseBait, generateBaitResponse, analyzeBaitResponse } = require('./baitStrategy');
const { governResponse, RESPONSE_MODES } = require('./responseGovernor');
const { getPhaseBasedBehavior } = require('../detection/scamAnalysisEngine');

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
 * AI Agent Service with Level 5 Bait Strategy + Response Governor
 * Manages AI-powered autonomous conversation with strategic confusion
 * 
 * 🟥 RESPONSE GOVERNOR: All responses are now filtered through the Response Governor
 *    which MANDATORILY overrides responses when risk thresholds are crossed.
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
    const { emotion = 'neutral' } = sessionData; // Get emotion from session

    // Determine the conversation context and phase
    const turnCount = conversationHistory.length;
    const phase = getConversationPhase(turnCount);

    // 3️⃣ CONVERSATION PHASE & BEHAVIOR
    // Phase is used for non-critical tone; Governor handles critical safety
    console.log(`[AgentService] Engagement Phase: ${phase}`);

    // We REMOVED the hardcoded freeze here because it's now handled by the 
    // Response Governor + Agent State Machine for more granular control.


    // LEVEL 5: Check if we should use bait strategy
    const useBait = shouldUseBait({ confidence, riskLevel }, phase, turnCount);

    let proposedResponse;
    let metadata = {
        usedBait: false,
        baitType: null,
        baitAnalysis: null,
        governor: null  // Will be populated by Response Governor
    };

    if (useBait) {
        // Use strategic bait response
        const bait = generateBaitResponse(userMessage, scamContext, phase);
        proposedResponse = bait.response;
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
                proposedResponse = text
                    .trim()
                    .replace(/^(Agent:|Response:|Reply:)\s*/i, '') // Remove any prefix
                    .substring(0, 200); // Limit length

                console.log(`🤖 Gemini response (${phase} phase)`);

            } catch (error) {
                console.error('❌ Gemini API error:', error.message);
                console.log('   Falling back to emotion-aware rule-based response');
                // Use emotion-aware response
                proposedResponse = generateEmotionAwareResponse(userMessage, phase, emotion, categories, conversationHistory);
            }
        } else {
            // Use emotion-aware rule-based responses
            proposedResponse = generateEmotionAwareResponse(userMessage, phase, emotion, categories, conversationHistory);
        }
    }

    // 🟥 RESPONSE GOVERNOR - MANDATORY OVERRIDE
    // Incorporate FSM state tracking
    const currentState = sessionData.fsmState || AGENT_STATES.SAFE;
    const { state: nextState, scenario: fsmScenario } = updateAgentState(userMessage, scamContext, currentState);
    console.log(`[AgentService] FSM Update: ${currentState} -> ${nextState} (Scenario: ${fsmScenario})`);

    // Save state back to metadata for return
    metadata.fsmState = nextState;
    metadata.fsmScenario = fsmScenario;

    // Calculate repetition count from conversation history
    const repetitionCount = calculateRepetitionCount(userMessage, conversationHistory);

    // Check if aggression is in categories
    const aggressionDetected = categories.includes('aggression');

    const governed = governResponse(confidence, proposedResponse, {
        fsmState: nextState,
        fsmScenario,
        userMessage,
        aggressionDetected,
        repetitionCount,
        safetyAdvice: scamContext.safetyAdvice || []
    });

    // Log governor action if it overrode the response
    if (governed.governorMetadata.overridden) {
        console.log(`🛡️  Response Governor [${governed.governorMetadata.fsmState}]: Overriding with LOCKED response`);
        console.log(`    Trigger: ${fsmScenario || 'confidence'} | Original: "${proposedResponse.substring(0, 50)}..."`);
        if (governed.governorMetadata.guardrailTriggered) {
            console.log(`    Guardrail: ${governed.governorMetadata.guardrailTriggered}`);
        }
    }


    // Update metadata with governor info
    metadata.governor = governed.governorMetadata;

    return {
        response: governed.response,
        metadata
    };
}

/**
 * Calculate how many times the current message is similar to previous messages
 * Used for repetition detection guardrail
 * 
 * @param {string} currentMessage - Current user message
 * @param {Array} conversationHistory - Previous conversation turns
 * @returns {number} - Number of similar previous messages
 */
function calculateRepetitionCount(currentMessage, conversationHistory) {
    if (!currentMessage || !conversationHistory || conversationHistory.length === 0) {
        return 0;
    }

    const current = currentMessage.toLowerCase().trim();
    const userMessages = conversationHistory
        .filter(h => h.role === 'user')
        .map(h => h.text.toLowerCase().trim());

    let count = 0;
    for (const msg of userMessages) {
        // Check for high similarity (Jaccard > 0.7 or exact match)
        if (msg === current || calculateSimilarity(current, msg) > 0.7) {
            count++;
        }
    }

    return count;
}

/**
 * Calculate text similarity using Jaccard similarity
 */
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

module.exports = {
    generateAgentResponse
};
