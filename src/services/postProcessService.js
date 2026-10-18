// src/services/postProcessService.js
// Background enrichment that runs after each honeypot turn has been answered, so the
// reply latency is unaffected: response quality scoring, alert dispatch, scammer profiling.
// Every step is isolated — a failure in one never affects the others or the API response.

const cron = require("node-cron");
const qualityService = require("./qualityService");
const alertService = require("./alertService");
const profilerService = require("./profilerService");
const analyticsService = require("./analyticsService");
const { getSessionIntelligence } = require("./sessionService");
const incidentService = require("./incidentService");


async function safely(label, fn) {
    try {
        return await fn();
    } catch (err) {
        console.error(`⚠️  post-process [${label}]: ${err.message}`);
        return null;
    }
}

/**
 * @param {object} turn
 * @param {string} turn.sessionId
 * @param {string} turn.agentReply
 * @param {string} turn.scammerMessage
 * @param {Array}  turn.history     conversation history before this turn
 * @param {object} turn.detection   detection result (after risk accumulation)
 * @param {object} turn.session     session snapshot
 * @param {string} turn.phase
 * @param {string} turn.emotion
 */
function runTurnPostProcessing(turn) {
    setImmediate(async () => {
        const { sessionId, agentReply, scammerMessage, history = [], detection, session, phase, emotion } = turn;
        const isScam = Boolean(detection?.scamDetected ?? detection?.isScam);
        const probability = detection?.scamProbability ?? 0;
        const turnNumber = history.length + 2;

        if (agentReply) {
            await safely("quality", () =>
                qualityService.scoreResponse(agentReply, scammerMessage, {
                    sessionId,
                    turnNumber,
                    phase,
                    riskScore: probability,
                    emotion,
                    persona: session?.persona,
                    conversationHistory: history,
                    lastScammerMessage: scammerMessage,
                })
            );
        }

        if (isScam) {
            await safely("alerts", async () => {
                const triggers = await alertService.checkTriggers({
                    sessionId,
                    scamProbability: probability,
                    scamType: detection.scamType,
                    patterns: detection.patterns,
                    pressureVelocity: detection.pressureVelocity?.velocity ?? detection.pressureVelocity,
                    turnCount: turnNumber,
                    intelligence: detection.intelligence,
                });
                if (!triggers.length) return;
                // Collapse into an incident: only new incidents / cross-session spread produce an outbound alert
                const intel = await getSessionIntelligence(sessionId);
                const { alerts } = await incidentService.registerEvent({
                    sessionId, triggers, intelligence: intel, riskScore: probability, scamType: detection.scamType,
                });
                for (const t of alerts) await alertService.sendAlert(t.type, t.payload);
            });

            // A profile fingerprints a scammer, so it needs something to key on (UPI / phone / link)
            await safely("profile", async () => {
                const intel = await getSessionIntelligence(sessionId);
                if (intel?.upiIds?.length || intel?.phoneNumbers?.length || intel?.urls?.length) {
                    await profilerService.buildProfile(sessionId);
                }
            });
        }
    });
}

/** Aggregate today's analytics shortly after boot and every 15 minutes thereafter. */
function startScheduledJobs() {
    const run = () => safely("analytics", () => analyticsService.aggregateDailyMetrics(new Date()));
    setTimeout(run, 5000);
    cron.schedule("*/15 * * * *", run);
    console.log("⏱️  Scheduled analytics aggregation (every 15 min)");
}

module.exports = { runTurnPostProcessing, startScheduledJobs };
