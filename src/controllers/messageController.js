// src/controllers/messageController.js
const { detectScamIntent } = require("../../detection/scamDetector");
const { generateAgentResponse } = require("../../agent/agentService");
const { shouldWrapUp } = require("../../agent/agentStateMachine");
const { extractIntelligence } = require("../../detection/intelligenceExtractor");
const {
    getOrCreateSession,
    updateSession,
    getConversationHistory,
    saveConversationTurn,
    determineEngagementPhase,
    getSessionIntelligence,
    updateSessionEmotion
} = require("../services/sessionService");
const { sendFinalCallback, formatIntelligenceReport } = require("../../agent/callbackService");
const { sanitizeText, calculateDuration } = require("../utils/helpers");

// New advanced features
const { checkKnownScammer, updateScammerIntelligence } = require("../services/crossSessionIntelligence");
const { selectPersona, applyPersona } = require("../../agent/personaSystem");
const auditService = require("../services/auditService");
const { detectEmotion } = require("../../detection/emotionDetector");

/**
 * Handle incoming message from external platform
 * Main entry point for the honeypot system
 * 
 * Supports MULTIPLE request formats:
 * 1. New format (evaluation platform):
 *    { sessionId, message: { sender, text, timestamp }, conversationHistory: [], metadata: {} }
 * 2. Legacy format:
 *    { sessionId, message: "text", platform, sender }
 * 3. Simple test format:
 *    { message: "text" } or { text: "text" }
 */
exports.handleIncomingMessage = async (req, res) => {
    try {
        // Handle empty or null body
        const body = req.body || {};
        let { sessionId, message, conversationHistory: providedHistory, metadata, text } = body;

        // Handle various message formats from GUVI tester
        // Support: { message: "text" }, { text: "text" }, { message: { text: "..." } }
        if (!message && text) {
            message = text; // Support { text: "..." } format
        }

        // If no message at all, return helpful test response (for GUVI tester validation)
        if (!message) {
            return res.json({
                status: "success",
                reply: "Honeypot API is active. Send a message to start."
            });
        }

        // Auto-generate sessionId if not provided
        if (!sessionId) {
            sessionId = `auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        }

        // Handle both new format (object) and legacy format (string)
        let messageText, sender, platform, timestamp;
        if (typeof message === 'object' && message.text) {
            // New evaluation platform format
            messageText = message.text;
            sender = message.sender || 'scammer';
            timestamp = message.timestamp;
            platform = metadata?.channel || 'API';
        } else {
            // Legacy format (backward compatibility)
            messageText = String(message);
            sender = req.body.sender || 'scammer';
            platform = req.body.platform || 'API';
        }

        // Sanitize input
        const sanitizedMessage = sanitizeText(messageText);

        // Get or create session
        const session = await getOrCreateSession(sessionId, platform, sender);

        // FEATURE 1: Assign persona on first interaction
        if (!session.persona) {
            const persona = selectPersona();
            session.persona = persona;
            await updateSession(sessionId, { persona });

            console.log(`🎭 Persona assigned: ${persona.name}`);
        }

        // Log session start (first message)
        if (!session.lastActiveAt || (Date.now() - session.lastActiveAt > 3600000)) {
            await auditService.logSessionStart(sessionId, platform, sender);
        }

        // Get conversation history - prefer provided history, fall back to database
        let history;
        if (providedHistory && Array.isArray(providedHistory) && providedHistory.length > 0) {
            // Map evaluation platform format to internal format
            history = providedHistory.map(turn => ({
                role: turn.sender === 'user' ? 'agent' : 'user', // 'user' in their format = our agent, 'scammer' = user
                text: turn.text,
                timestamp: turn.timestamp
            }));
        } else {
            history = await getConversationHistory(sessionId);
        }

        // EMOTION LAYER: Detect emotion FIRST (before scam detection)
        const emotionResult = detectEmotion(sanitizedMessage, session.emotionHistory || []);
        const { emotion, intensity } = emotionResult;

        // Update session with detected emotion
        await updateSessionEmotion(sessionId, emotion, intensity);

        console.log(`😊 Emotion detected: ${emotion} (intensity: ${intensity.toFixed(2)})`);

        // Detect scam intent with conversation context
        const scamDetection = await detectScamIntent(sanitizedMessage, history);


        // Extract intelligence from the message
        const intelligence = extractIntelligence(sanitizedMessage);

        // FEATURE 2: Cross-session intelligence check
        let knownScammerInfo = { isKnown: false };
        if (intelligence.upiIds.length > 0 || intelligence.phoneNumbers.length > 0) {
            knownScammerInfo = await checkKnownScammer(intelligence.upiIds, intelligence.phoneNumbers);

            if (knownScammerInfo.isKnown) {
                console.log(`🚨 REPEAT SCAMMER DETECTED! Sessions: ${knownScammerInfo.sessionCount}`);

                // Log repeat scammer detection
                await auditService.logRepeatScammer(sessionId, knownScammerInfo);

                // Boost confidence if known scammer
                scamDetection.confidence = Math.min(scamDetection.confidence + 0.2, 1.0);
                scamDetection.riskLevel = knownScammerInfo.riskLevel;
            }
        }

        // FEATURE 3: Log incoming message with full context
        await auditService.logMessageReceived(
            sessionId,
            sanitizedMessage,
            scamDetection,
            intelligence,
            knownScammerInfo
        );

        // Save user's message turn
        await saveConversationTurn(
            sessionId,
            "user",
            sanitizedMessage,
            intelligence,
            scamDetection.isScam
        );

        // Update session with scam status if detected
        if (scamDetection.isScam && session.isScam === null) {
            await updateSession(sessionId, { isScam: true });
            await auditService.logScamDetected(sessionId, scamDetection, intelligence);
        }

        // Determine if we should engage the AI agent
        let agentReply = "I'm not sure how to respond to that.";
        let baitMetadata = null;
        let sessionUpdates = {
            fsmState: session.fsmState || 'SAFE',
            fsmScenario: session.fsmScenario || null
        };

        // CHANGED: Always engage the agent for natural conversation handling
        // Even non-scam messages need proper responses (de-escalation, clarification, etc.)
        let shouldEngage = true; // Was: scamDetection.isScam || session.isScam === true

        if (shouldEngage) {
            // Generate AI agent response with bait strategy
            const phase = await determineEngagementPhase(sessionId);
            const agentResult = await generateAgentResponse(
                sanitizedMessage,
                history,
                scamDetection,
                {
                    emotion,  // Pass detected emotion
                    lastBaitType: session.lastBaitType,
                    baitUsedCount: session.baitUsedCount || 0,
                    fsmState: session.fsmState || 'SAFE'
                }
            );

            // Extract response and metadata
            agentReply = agentResult.response || agentResult;
            baitMetadata = agentResult.metadata || null;

            // FEATURE 4: Apply persona to response
            if (session.persona) {
                agentReply = applyPersona(agentReply, session.persona, phase);
            }

            // Save agent's response turn
            await saveConversationTurn(sessionId, "agent", agentReply);

            // Log agent response with state
            await auditService.logAgentResponse(
                sessionId,
                agentReply,
                {
                    phase,
                    persona: session.persona?.type,
                    baitType: baitMetadata?.baitType,
                    turnCount: history.length + 2
                },
                baitMetadata?.usedBait || false
            );

            // Log bait if used
            if (baitMetadata?.usedBait) {
                await auditService.logBaitDeployed(sessionId, baitMetadata.baitType, phase);
            }

            // Update session with bait and FSM tracking
            sessionUpdates = { // Update the existing 'let' variable
                ...sessionUpdates,
                engagementPhase: phase,
                fsmState: baitMetadata?.fsmState || session.fsmState,
                fsmScenario: baitMetadata?.fsmScenario || session.fsmScenario
            };

            if (baitMetadata && baitMetadata.usedBait) {
                sessionUpdates.lastBaitType = baitMetadata.baitType;
                sessionUpdates.baitUsedCount = (session.baitUsedCount || 0) + 1;

                // Track evasion and reveals
                if (baitMetadata.baitAnalysis) {
                    const prevEvasion = session.evasionScore || 0;
                    sessionUpdates.evasionScore = Math.min(
                        prevEvasion + baitMetadata.baitAnalysis.evasionScore,
                        1.0
                    );

                    if (baitMetadata.baitAnalysis.triggeredReveal) {
                        sessionUpdates.triggeredReveal = true;
                    }
                }
            }

            await updateSession(sessionId, sessionUpdates);

            // FEATURE 5: Update cross-session intelligence (only if scam detected)
            if (scamDetection.isScam && (intelligence.upiIds.length > 0 || intelligence.phoneNumbers.length > 0)) {
                await updateScammerIntelligence(intelligence, sessionId, scamDetection);
                await auditService.logIntelligenceExtracted(sessionId, intelligence);
            }

            // Check if we should wrap up the conversation (only for confirmed scams)
            if (scamDetection.isScam || session.isScam === true) {
                const allIntel = await getSessionIntelligence(sessionId);
                const turnCount = history.length + 2; // +2 for the turns we just saved

                if (shouldWrapUp(turnCount, allIntel)) {
                    // Mark session as final phase
                    await updateSession(sessionId, {
                        status: "terminated",
                        engagementPhase: "final"
                    });

                    // Send callback if not already sent
                    if (!session.finalCallbackSent) {
                        const duration = calculateDuration(session.createdAt);

                        const callbackResult = await sendFinalCallback(
                            sessionId,
                            allIntel,
                            {
                                platform: session.platform,
                                sender: session.sender,
                                totalTurns: turnCount,
                                duration,
                                engagementPhase: "final",
                                isScam: true,
                                scamConfidence: scamDetection.confidence,
                                fsmState: sessionUpdates.fsmState || session.fsmState
                            }
                        );

                        // Mark callback as sent
                        await updateSession(sessionId, {
                            finalCallbackSent: true
                        });

                        // Log the intelligence report
                        console.log(formatIntelligenceReport(sessionId, allIntel));
                    }
                }
            }
        }

        // Prepare response - simplified format for evaluation platform
        const response = {
            status: "success",
            reply: agentReply
        };

        return res.json(response);

    } catch (error) {
        console.error("Error handling message:", error);

        return res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
};

/**
 * Get session details (optional endpoint for monitoring)
 */
exports.getSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const Session = require("../models/Session");
        const session = await Session.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                error: "Session not found"
            });
        }

        const history = await getConversationHistory(sessionId);
        const intelligence = await getSessionIntelligence(sessionId);

        return res.json({
            session: {
                sessionId: session.sessionId,
                platform: session.platform,
                sender: session.sender,
                status: session.status,
                isScam: session.isScam,
                engagementPhase: session.engagementPhase,
                createdAt: session.createdAt,
                lastActiveAt: session.lastActiveAt,
                finalCallbackSent: session.finalCallbackSent
            },
            conversationTurns: history.length,
            extractedIntelligence: intelligence
        });

    } catch (error) {
        console.error("Error fetching session:", error);

        return res.status(500).json({
            error: "Internal server error",
            message: error.message
        });
    }
};
