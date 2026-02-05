// src/telegram/telegramBot.js
const TelegramBot = require('node-telegram-bot-api');
const Session = require('../models/Session');
const ConversationTurn = require('../models/ConversationTurn');
const scamDetector = require('../../detection/scamDetector');
const agentService = require('../../agent/agentService');
const intelligenceExtractor = require('../../detection/intelligenceExtractor');

/**
 * Telegram Bot Service
 * Provides live interactive scam detection via Telegram
 */
class TelegramBotService {
    constructor() {
        this.bot = null;
        this.activeSessions = new Map(); // chatId -> session data
    }

    /**
     * Initialize the bot
     */
    async initialize() {
        const token = process.env.TELEGRAM_BOT_TOKEN;

        if (!token) {
            console.log('⚠️  TELEGRAM_BOT_TOKEN not set - Telegram bot disabled');
            return false;
        }

        try {
            this.bot = new TelegramBot(token, { polling: true });

            // Register command handlers
            this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
            this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
            this.bot.onText(/\/reset/, (msg) => this.handleReset(msg));
            this.bot.onText(/\/stats/, (msg) => this.handleStats(msg));
            this.bot.onText(/\/report/, (msg) => this.handleReport(msg));

            // Handle regular messages
            this.bot.on('message', (msg) => {
                // Skip if it's a command
                if (msg.text && msg.text.startsWith('/')) return;
                this.handleMessage(msg);
            });

            // Error handler
            this.bot.on('polling_error', (error) => {
                console.error('Telegram polling error:', error.message);
            });

            const botInfo = await this.bot.getMe();
            console.log(`✅ Telegram Bot initialized: @${botInfo.username}`);
            console.log(`📱 Users can message: https://t.me/${botInfo.username}`);

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Telegram bot:', error.message);
            return false;
        }
    }

    /**
     * Handle /start command
     */
    async handleStart(msg) {
        const chatId = msg.chat.id;

        const welcomeMessage = `
🐝 *Welcome to Honeypot Scam Detector!*

I'm an AI-powered scam detection system. Try to scam me and watch me detect it!

*How to use:*
• Send any message (try scam tactics!)
• I'll respond like a human
• Behind scenes, I analyze everything
• Get detailed scam analysis

*Try these examples:*
• "Your account will be blocked. Verify now!"
• "You won Rs. 5 lakhs! Send OTP to claim"
• "I'm from bank. Share card details urgently"

*Commands:*
/help - Show this message
/stats - View your session statistics
/reset - Start a new conversation
/report - Get detailed analysis report

*Features:*
✅ Multi-language (English/Hindi/Hinglish)
✅ Behavioral profiling
✅ Real-time threat detection
✅ Quality-scored responses

Let's begin! Send me a message...
    `;

        await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });

        // Initialize session
        const sessionId = `telegram_${chatId}`;
        await this.createSession(sessionId, chatId);
    }

    /**
     * Handle /help command
     */
    async handleHelp(msg) {
        const chatId = msg.chat.id;
        await this.handleStart(msg); // Reuse start message
    }

    /**
     * Handle /reset command
     */
    async handleReset(msg) {
        const chatId = msg.chat.id;
        const sessionId = `telegram_${chatId}`;

        // Archive old session
        const oldSession = await Session.findOne({ sessionId });
        if (oldSession) {
            oldSession.status = 'terminated';
            await oldSession.save();
        }

        // Clear active session
        this.activeSessions.delete(chatId);

        // Create new session
        await this.createSession(sessionId, chatId);

        await this.bot.sendMessage(chatId, '🔄 *Session reset!* Starting fresh conversation...', {
            parse_mode: 'Markdown'
        });
    }

    /**
     * Handle /stats command
     */
    async handleStats(msg) {
        const chatId = msg.chat.id;
        const sessionId = `telegram_${chatId}`;

        try {
            const session = await Session.findOne({ sessionId });
            const turns = await ConversationTurn.find({ sessionId });

            if (!session) {
                await this.bot.sendMessage(chatId, 'No active session. Send /start to begin!');
                return;
            }

            const scammerTurns = turns.filter(t => t.role === 'user').length;
            const agentTurns = turns.filter(t => t.role === 'assistant').length;

            // Extract intelligence
            const intelligence = {
                upiIds: new Set(),
                phoneNumbers: new Set(),
                urls: new Set()
            };

            for (const turn of turns.filter(t => t.role === 'user')) {
                const intel = intelligenceExtractor.extractAll(turn.text);
                intel.upiIds.forEach(id => intelligence.upiIds.add(id));
                intel.phoneNumbers.forEach(num => intelligence.phoneNumbers.add(num));
                intel.urls.forEach(url => intelligence.urls.add(url));
            }

            const statsMessage = `
📊 *Session Statistics*

*Detection Status:*
${session.scamEverDetected ? '🚨 SCAM DETECTED' : '✅ No scam detected'}
Probability: ${session.maxScamProbability}%
Risk Level: ${this.getRiskLevel(session.maxScamProbability)}

*Conversation:*
Total Turns: ${turns.length}
Your Messages: ${scammerTurns}
Agent Responses: ${agentTurns}
Current Phase: ${session.highestPhase}

*Intelligence Extracted:*
UPI IDs: ${intelligence.upiIds.size}
Phone Numbers: ${intelligence.phoneNumbers.size}
URLs: ${intelligence.urls.size}

*Session Info:*
ID: \`${sessionId}\`
Started: ${new Date(session.createdAt).toLocaleString()}
Status: ${session.status}

Use /report for detailed analysis!
      `;

            await this.bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Error getting stats:', error);
            await this.bot.sendMessage(chatId, '❌ Error retrieving statistics');
        }
    }

    /**
     * Handle /report command
     */
    async handleReport(msg) {
        const chatId = msg.chat.id;
        const sessionId = `telegram_${chatId}`;

        try {
            const session = await Session.findOne({ sessionId });
            const turns = await ConversationTurn.find({ sessionId }).sort({ timestamp: 1 });

            if (!session || turns.length === 0) {
                await this.bot.sendMessage(chatId, 'No conversation data available. Start chatting first!');
                return;
            }

            // Send "generating" message
            const processingMsg = await this.bot.sendMessage(chatId, '⏳ Generating detailed report...');

            // Analyze last detection
            const lastUserTurn = turns.filter(t => t.role === 'user').pop();
            let detectionDetails = null;

            if (lastUserTurn) {
                detectionDetails = await scamDetector.detectScamIntent(
                    lastUserTurn.text,
                    turns.slice(0, -1).map(t => ({
                        role: t.role,
                        text: t.text,
                        timestamp: t.timestamp
                    })),
                    { sessionId }
                );
            }

            // Build report
            let report = `📄 *DETAILED ANALYSIS REPORT*\n\n`;

            // Risk Assessment
            report += `*🚨 RISK ASSESSMENT*\n`;
            report += `Status: ${session.scamEverDetected ? '**SCAM DETECTED**' : 'Clean'}\n`;
            report += `Confidence: ${session.maxScamProbability}%\n`;
            report += `Risk Level: ${this.getRiskLevel(session.maxScamProbability)}\n`;
            report += `Phase: ${session.highestPhase}\n\n`;

            // Scam Type & Reasoning
            if (detectionDetails && detectionDetails.isScam) {
                report += `*🎯 SCAM CLASSIFICATION*\n`;
                report += `Type: ${detectionDetails.scamType || 'UNKNOWN'}\n`;

                if (detectionDetails.reasoning && detectionDetails.reasoning.length > 0) {
                    report += `\n*💡 DETECTION REASONING:*\n`;
                    detectionDetails.reasoning.forEach((reason, i) => {
                        report += `${i + 1}. ${reason}\n`;
                    });
                }

                if (detectionDetails.safetyAdvice && detectionDetails.safetyAdvice.length > 0) {
                    report += `\n*🛡️ SAFETY ADVICE:*\n`;
                    detectionDetails.safetyAdvice.forEach((advice, i) => {
                        report += `${i + 1}. ${advice}\n`;
                    });
                }
                report += `\n`;
            }

            // Intelligence Extracted
            const intel = this.extractAllIntelligence(turns);
            if (intel.upiIds.size > 0 || intel.phoneNumbers.size > 0 || intel.urls.size > 0) {
                report += `*🔍 INTELLIGENCE EXTRACTED*\n`;
                if (intel.upiIds.size > 0) {
                    report += `UPI IDs: ${Array.from(intel.upiIds).join(', ')}\n`;
                }
                if (intel.phoneNumbers.size > 0) {
                    report += `Phone: ${Array.from(intel.phoneNumbers).join(', ')}\n`;
                }
                if (intel.urls.size > 0) {
                    report += `URLs: ${Array.from(intel.urls).join(', ')}\n`;
                }
                report += `\n`;
            }

            // Behavioral Analysis
            if (detectionDetails) {
                report += `*🧠 BEHAVIORAL ANALYSIS*\n`;
                report += `Pressure Velocity: ${detectionDetails.pressureVelocity || 'N/A'}\n`;
                report += `User Vulnerability: ${detectionDetails.userVulnerability || 'N/A'}\n`;
                report += `Confidence Locked: ${detectionDetails.confidenceLocked ? 'Yes' : 'No'}\n\n`;
            }

            // Conversation Summary
            report += `*💬 CONVERSATION SUMMARY*\n`;
            report += `Total Turns: ${turns.length}\n`;
            report += `Duration: ${this.getSessionDuration(session)}\n`;
            report += `Platform: Telegram\n\n`;

            report += `_Generated: ${new Date().toLocaleString()}_\n`;
            report += `_Session ID: \`${sessionId}\`_`;

            // Delete processing message
            await this.bot.deleteMessage(chatId, processingMsg.message_id);

            // Send report
            await this.bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });

            // Offer PDF export
            await this.bot.sendMessage(chatId,
                '💡 Want a PDF report? Use the web dashboard at your deployment URL!'
            );

        } catch (error) {
            console.error('Error generating report:', error);
            await this.bot.sendMessage(chatId, '❌ Error generating report');
        }
    }

    /**
     * Handle regular messages
     */
    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return; // Ignore non-text messages

        const sessionId = `telegram_${chatId}`;

        try {
            // Ensure session exists
            let session = await Session.findOne({ sessionId });
            if (!session) {
                session = await this.createSession(sessionId, chatId);
            }

            // Get conversation history
            const previousTurns = await ConversationTurn.find({ sessionId })
                .sort({ timestamp: 1 })
                .limit(50);

            const conversationHistory = previousTurns.map(turn => ({
                role: turn.role,
                text: turn.text,
                timestamp: turn.timestamp
            }));

            // Detect scam
            const detection = await scamDetector.detectScamIntent(
                text,
                conversationHistory,
                { sessionId, platform: 'telegram' }
            );

            // Generate agent response
            const response = await agentService.generateAgentResponse(
                text,
                conversationHistory,
                {
                    scamDetected: detection.isScam,
                    scamProbability: detection.confidence * 100,
                    scamType: detection.scamType,
                    detectedPatterns: detection.detectedPatterns
                },
                { sessionId, platform: 'telegram' }
            );

            // Save user message
            const userTurnCount = previousTurns.filter(t => t.role === 'user').length;
            await ConversationTurn.create({
                sessionId,
                turnIndex: userTurnCount * 2,
                role: 'user',
                text: text,
                timestamp: new Date(),
                detectedScamIntent: detection.isScam,
                extractedIntel: {
                    upiIds: detection.detectedPatterns?.filter(p => p.includes('upi')) || [],
                    phoneNumbers: [],
                    urls: [],
                    scamPhrases: detection.detectedPatterns || [],
                    behavioralPatterns: []
                }
            });

            // Save agent response
            await ConversationTurn.create({
                sessionId,
                turnIndex: userTurnCount * 2 + 1,
                role: 'agent',
                text: response.response || 'Sorry, I could not generate a response.',
                timestamp: new Date(),
                detectedScamIntent: false,
                extractedIntel: {}
            });

            // Update session
            const scamProbability = detection.confidence * 100;
            session.maxScamProbability = Math.max(session.maxScamProbability, scamProbability);
            session.scamEverDetected = session.scamEverDetected || detection.isScam;
            session.highestPhase = this.getHigherPhase(session.highestPhase, detection.riskLevel === 'CRITICAL' ? 'final' : detection.riskLevel === 'HIGH' ? 'late' : detection.riskLevel === 'MEDIUM' ? 'mid' : 'early');
            session.lastActiveAt = new Date();
            await session.save();

            // Send response to user
            await this.bot.sendMessage(chatId, response.response || 'Sorry, I could not generate a response.');

            // Send detection alert if high risk
            if (scamProbability >= 70 && previousTurns.length >= 3) {
                const alertMsg = `
⚠️ *Scam Detection Alert*
Probability: ${Math.round(scamProbability)}%
Type: ${detection.scamType || 'Unknown'}

Use /stats or /report for details!
        `;
                await this.bot.sendMessage(chatId, alertMsg, { parse_mode: 'Markdown' });
            }

        } catch (error) {
            console.error('Error handling message:', error);
            await this.bot.sendMessage(chatId,
                '❌ Sorry, I encountered an error. Please try /reset to start fresh.'
            );
        }
    }

    /**
     * Create new session
     */
    async createSession(sessionId, chatId) {
        const session = await Session.findOneAndUpdate(
            { sessionId },
            {
                $setOnInsert: {
                    sessionId,
                    platform: 'telegram',
                    status: 'active',
                    scamEverDetected: false,
                    maxScamProbability: 0,
                    highestPhase: 'early',
                    metadata: {
                        telegramChatId: chatId
                    }
                }
            },
            { upsert: true, new: true }
        );

        this.activeSessions.set(chatId, {
            sessionId,
            startedAt: new Date()
        });

        return session;
    }

    /**
     * Extract all intelligence from conversation
     */
    extractAllIntelligence(turns) {
        const intelligence = {
            upiIds: new Set(),
            phoneNumbers: new Set(),
            urls: new Set()
        };

        for (const turn of turns.filter(t => t.role === 'user')) {
            const intel = intelligenceExtractor.extractAll(turn.text);
            intel.upiIds.forEach(id => intelligence.upiIds.add(id));
            intel.phoneNumbers.forEach(num => intelligence.phoneNumbers.add(num));
            intel.urls.forEach(url => intelligence.urls.add(url));
        }

        return intelligence;
    }

    /**
     * Get risk level label
     */
    getRiskLevel(probability) {
        if (probability >= 80) return '🔴 CRITICAL';
        if (probability >= 60) return '🟠 HIGH';
        if (probability >= 40) return '🟡 MEDIUM';
        if (probability >= 20) return '🟢 LOW';
        return '⚪ SAFE';
    }

    /**
     * Get higher phase
     */
    getHigherPhase(current, newPhase) {
        const order = ['early', 'mid', 'late', 'final'];
        const currentIdx = order.indexOf(current);
        const newIdx = order.indexOf(newPhase);
        return newIdx > currentIdx ? newPhase : current;
    }

    /**
     * Get session duration
     */
    getSessionDuration(session) {
        const start = new Date(session.createdAt);
        const end = session.lastActiveAt || new Date();
        const diff = end - start;
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Stop the bot
     */
    stop() {
        if (this.bot) {
            this.bot.stopPolling();
            console.log('🛑 Telegram bot stopped');
        }
    }
}

module.exports = new TelegramBotService();
