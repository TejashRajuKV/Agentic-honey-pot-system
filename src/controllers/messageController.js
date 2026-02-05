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

// Session model for Risk Accumulation Engine
const Session = require("../models/Session");

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
        // Handle empty or null body - CRITICAL for GUVI tester
        const body = req.body || {};

        // Extract message from any possible field name
        let message = body.message || body.text || body.input || null;
        let sessionId = body.sessionId;
        let providedHistory = body.conversationHistory;
        let metadata = body.metadata;

        // Handle nested message object: { message: { text: "..." } }
        if (message && typeof message === 'object' && message.text) {
            // Keep as-is, will be handled below
        } else if (typeof message === 'string') {
            // Simple string message, wrap it
            message = { text: message, sender: 'scammer', timestamp: Date.now() };
        }

        // ========================================================================
        // RISK ACCUMULATION ENGINE - CRITICAL FOR HACKATHON
        // Once scam is detected, it NEVER becomes false
        // Probability can ONLY increase, never decrease
        // Phase can ONLY progress forward: early → mid → late → final
        // ========================================================================

        const PHASE_ORDER = { 'early': 0, 'mid': 1, 'late': 2, 'final': 3 };

        // Helper to get higher phase (monotonic progression)
        const getHigherPhase = (current, newPhase) => {
            const currentOrder = PHASE_ORDER[current] || 0;
            const newOrder = PHASE_ORDER[newPhase] || 0;
            return newOrder > currentOrder ? newPhase : current;
        };

        // Helper to calculate current phase from detection
        const calculatePhase = (detection, scamProbability, sessionState) => {
            // Check session termination states first
            if (sessionState.status === 'terminated' || sessionState.fsmState === 'TERMINATED') {
                return 'final';
            }
            if (detection.riskLevel === 'CRITICAL' || scamProbability >= 90) {
                return 'late';
            }
            if (detection.riskLevel === 'HIGH' || scamProbability >= 70) {
                return 'late';
            }
            if (detection.riskLevel === 'MEDIUM' || scamProbability >= 40) {
                return 'mid';
            }
            if (detection.isScam) {
                return 'mid'; // Any detected scam is at least 'mid'
            }
            return 'early';
        };

        // RISK ACCUMULATION: Apply monotonic state updates
        const applyRiskAccumulation = (detection = {}, session = {}) => {
            // Get current detection values
            const currentScamDetected = Boolean(detection.isScam);
            const rawProbability = Number.isFinite(detection.confidence)
                ? Math.round(detection.confidence * 100)
                : 0;
            const currentProbability = currentScamDetected ? Math.max(rawProbability, 30) : rawProbability;
            const currentPhase = calculatePhase(detection, currentProbability, session);

            // Get accumulated state from session (defaults if not present)
            const accumulatedScam = Boolean(session.scamEverDetected);
            const accumulatedProbability = Number(session.maxScamProbability) || 0;
            const accumulatedPhase = session.highestPhase || 'early';

            // APPLY MONOTONIC RULES:
            // 1. Once true, ALWAYS true
            const finalScamDetected = accumulatedScam || currentScamDetected;

            // 2. Probability can ONLY increase
            const finalProbability = Math.max(accumulatedProbability, currentProbability);

            // 3. Phase can ONLY progress forward
            const finalPhase = getHigherPhase(accumulatedPhase, currentPhase);

            // Return the accumulated result
            return {
                scamDetected: finalScamDetected,
                scamProbability: finalProbability,
                phase: finalPhase,
                patterns: Array.isArray(detection.detectedPatterns)
                    ? detection.detectedPatterns
                    : [],
                // Return values to save back to session
                _sessionUpdates: {
                    scamEverDetected: finalScamDetected,
                    maxScamProbability: finalProbability,
                    highestPhase: finalPhase
                }
            };
        };

        // If no message at all (empty body from GUVI tester), return valid response
        if (!message || (typeof message === 'object' && !message.text)) {
            const defaults = applyRiskAccumulation({}, {});
            return res.json({
                status: "success",
                reply: "Hello. Please tell me more details.",
                scamDetected: defaults.scamDetected,
                scamProbability: defaults.scamProbability,
                phase: defaults.phase,
                patterns: defaults.patterns
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
        // Pass session data for confidence decay protection
        const scamDetection = await detectScamIntent(sanitizedMessage, history, {
            previousConfidence: session.maxScamProbability ? session.maxScamProbability / 100 : 0,
            confidenceLocked: session.confidenceLocked || false
        });


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

        // Prepare response - include ALL required scam detection fields for GUVI tester
        // Use current session for risk accumulation (read accumulated values)
        const currentSession = await Session.findOne({ sessionId }) || {};
        const safeResult = applyRiskAccumulation(scamDetection, currentSession);

        // CRITICAL: Save accumulated state back to session (monotonic values)
        if (safeResult._sessionUpdates) {
            await Session.updateOne(
                { sessionId },
                {
                    $set: {
                        scamEverDetected: safeResult._sessionUpdates.scamEverDetected,
                        maxScamProbability: safeResult._sessionUpdates.maxScamProbability,
                        highestPhase: safeResult._sessionUpdates.highestPhase,
                        confidenceLocked: scamDetection.confidenceLocked || false,
                        userVulnerability: scamDetection.userVulnerability?.vulnerability || 'low',
                        scamType: scamDetection.scamType || 'UNKNOWN_SCAM'
                    }
                },
                { upsert: true }
            );
        }

        // Build enhanced response with all 8 new features
        const response = {
            status: "success",
            reply: agentReply,
            scamDetected: safeResult.scamDetected,
            scamProbability: safeResult.scamProbability,
            phase: safeResult.phase,
            patterns: safeResult.patterns,
            // ========== NEW FEATURES ==========
            // 1️⃣ Risk Explanation Layer
            reasoning: scamDetection.reasoning || [],
            // 2️⃣ User Safety Guidance
            safetyAdvice: scamDetection.safetyAdvice || [],
            // 4️⃣ Pressure Velocity Score
            pressureVelocity: scamDetection.pressureVelocity?.velocity || 'slow',
            // 5️⃣ User Vulnerability Detection
            userVulnerability: scamDetection.userVulnerability?.vulnerability || 'low',
            // 6️⃣ Scam Archetype Label
            scamType: scamDetection.scamType || 'UNKNOWN_SCAM',
            // 7️⃣ Confidence Decay Protection
            confidenceLocked: scamDetection.confidenceLocked || false,
            // 8️⃣ User Override / Feedback
            userClaimedLegitimate: scamDetection.userClaimedLegitimate || false
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
