// agent/conversationHandler.js

/**
 * Enhanced rule-based conversation handler
 * Implements expert agent behavior: fishing, not fighting
 * 
 * Golden Rules:
 * 1. Never accuse
 * 2. Sound human (imperfect, confused)
 * 3. Delay actions
 * 4. Extract information through questions
 */

/**
 * Generate emotion-aware response
 * Checks emotion-based handlers FIRST, then falls back to standard scam-type responses
 * @param {string} userMessage - User's message
 * @param {string} phase - Engagement phase  
 * @param {string} emotion - Detected emotion
 * @param {Array} categories - Scam categories
 * @param {Array} conversationHistory - Conversation history
 * @returns {string} - Agent response
 */
function generateEmotionAwareResponse(userMessage, phase, emotion, categories = [], conversationHistory = []) {
    const msg = userMessage.toLowerCase();
    const context = buildConversationContext(conversationHistory);

    // SAFETY GUARD: Never allow dangerous actions regardless of emotion
    if (requiresSafetyGuard(msg, context)) {
        return pickRandom([
            "I'm not comfortable doing that. Can you explain why this is needed?",
            "That doesn't seem right. How do I know this is legitimate?",
            "I need to verify this first. Can you give me more information?",
            "I'm hesitant about this. Is there another way?"
        ]);
    }

    // PRIORITY: Check emotion-specific handlers
    // These override standard responses when emotion is high-priority
    let emotionResponse = null;

    if (emotion === 'angry') {
        emotionResponse = handleAngryEmotion(phase, context);
    } else if (emotion === 'confused') {
        emotionResponse = handleConfusedEmotion(phase, context, msg);
    } else if (emotion === 'fear') {
        emotionResponse = handleFearEmotion(phase, context);
    } else if (emotion === 'urgent') {
        emotionResponse = handleUrgentEmotion(phase, context);
    } else if (emotion === 'excited') {
        emotionResponse = handleExcitedEmotion(phase, context);
    } else if (emotion === 'trusting') {
        emotionResponse = handleTrustingEmotion(phase, context);
    } else if (emotion === 'hesitant') {
        emotionResponse = handleHesitantEmotion(phase, context);
    }

    // If emotion handler returned a response, use it
    if (emotionResponse) {
        return emotionResponse;
    }

    // Otherwise, fall back to standard scam-type responses
    return generateRuleBasedResponse(userMessage, phase, categories, conversationHistory);
}

// Helper function to check safety guard (imported from emotionDetector)
function requiresSafetyGuard(message, context = {}) {
    const msg = message.toLowerCase();
    const dangerousPatterns = [
        /share.*otp|send.*otp|give.*otp|tell.*otp/i,
        /send.*money|transfer.*money|pay.*amount/i,
        /click.*link|open.*link|visit.*link/i,
        /install.*app|download.*app/i,
        /share.*password|give.*password|tell.*password/i,
        /cvv|card.*number|pin.*number/i
    ];
    return dangerousPatterns.some(pattern => pattern.test(msg));
}

/**
 * Generate ADAPTIVE contextual response based on conversation history
 * Following 5-level reply strategy with context awareness
 */
function generateRuleBasedResponse(userMessage, phase, categories = [], conversationHistory = []) {
    const msg = userMessage.toLowerCase();

    // Build conversation context from history
    const context = buildConversationContext(conversationHistory);

    // Calculate repetition count for current message
    const userMessages = conversationHistory
        .filter(h => h.role === 'user')
        .map(h => h.text.toLowerCase());
    context.repetitionCount = userMessages.filter(m => {
        // Simple similarity check
        const similarity = m.split(' ').filter(word => msg.includes(word)).length / Math.max(m.split(' ').length, msg.split(' ').length);
        return similarity > 0.7;
    }).length;

    // PRIORITY CHECK: Edge-case handlers (check these first, before standard responses)
    // These override standard response templates when detected

    // NEW: Check for context-aware responses first
    let contextResponse = getContextAwareResponse(context, msg);
    if (contextResponse) return contextResponse;

    // Check for aggression (rage phase)
    let edgeCaseResponse = handleAggression(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for repetition (silent pressure)
    edgeCaseResponse = handleRepetition(context, msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for contradiction detection
    edgeCaseResponse = handleContradiction(context, msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for authority claims
    edgeCaseResponse = handleAuthorityClaims(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for emotional manipulation
    edgeCaseResponse = handleEmotionalManipulation(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for multiple requests (cognit overload)
    edgeCaseResponse = handleMultipleRequests(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // FIX #3: Check for reverse scam (victim initiates contact)
    edgeCaseResponse = handleReverseScam(context, msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // FIX #8: Check for language switching (Hindi/Hinglish)
    edgeCaseResponse = handleLanguageSwitching(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // FIX #12: Check for identity escalation (senior officer)
    edgeCaseResponse = handleIdentityEscalation(context, msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // FIX #17: Check for threat + help combo
    edgeCaseResponse = handleThreatHelpCombo(msg);
    if (edgeCaseResponse) return edgeCaseResponse;

    // Check for slow-burn escalation
    edgeCaseResponse = handleSlowBurnEscalation(context);
    if (edgeCaseResponse) return edgeCaseResponse;

    // If no edge case detected, proceed with standard scam-type responses

    // Detect what information is present or requested
    const hasKYC = /kyc|verify|update|account/i.test(msg);
    const hasOTP = /otp|pin|code/i.test(msg);
    const hasUPI = /upi|paytm|phonepe|gpay|@/i.test(msg);
    const hasLottery = /won|lottery|prize|car|iphone|gift/i.test(msg);
    const hasMoney = /send|pay|money|rupees|amount|₹/i.test(msg);
    const hasLink = /link|click|website|url|http/i.test(msg);
    const hasNumber = /\d{10}|\d{4}/i.test(msg);
    const hasUrgency = /urgent|immediate|now|quick|fast|hurry/i.test(msg);

    // Extract specific details from current message
    const upiMatch = msg.match(/([a-z0-9._-]+@[a-z]+)/i);
    const phoneMatch = msg.match(/(\d{10})/);
    const amountMatch = msg.match(/₹\s*(\d+)|rupees\s*(\d+)/i);
    const urlMatch = msg.match(/(https?:\/\/[^\s]+)/i);

    // Detect scam scenario types for realistic responses
    const scenarios = {
        authority: /bank|government|police|income tax|rbi|sebi|official|department/i.test(msg),
        emergency: /urgent|immediate|now|quick|today|hurry|asap|block|suspend|expire/i.test(msg),
        prize: /won|lottery|prize|reward|gift|selected|winner|congratulations/i.test(msg),
        job: /job|work from home|earn|salary|hiring|vacancy|opportunity/i.test(msg),
        refund: /refund|cashback|claim|credited|excess|return|reimburse/i.test(msg),
        technical: /kyc|verify|update|otp|pin|suspended|blocked|deactivate/i.test(msg),
        investment: /invest|returns|profit|guaranteed|double|scheme|plan/i.test(msg),
        threat: /legal action|complaint|case|arrest|penalty|fine|court/i.test(msg)
    };

    // LEVEL 1: Opening Replies (Hook the scammer) - Realistic emotional responses
    if (phase === 'early') {
        // AUTHORITY CLAIMS - Show fear/worry
        if (scenarios.authority && scenarios.threat) {
            if (context.askedAboutKYC) {
                return "You said earlier about verification. Now you're talking about legal action? I'm really scared...";
            }
            return pickRandom([
                "Legal action? What did I do wrong? I'm so worried now 😰",
                "Please sir, I don't want any trouble. Tell me what I need to do.",
                "This is very serious... I'm getting scared. Is my account really in danger?",
                "I don't understand what happened. Can you please explain slowly?"
            ]);
        }

        if (scenarios.authority) {
            if (context.askedAboutKYC) {
                return "You mentioned this before. I'm still trying to understand what I need to do.";
            }
            return pickRandom([
                "Oh no, is this from my bank? I'm worried now. What's the problem?",
                "I didn't expect a message from official department. Is something wrong?",
                "This sounds important. Can you tell me what I need to do?",
                "I want to cooperate. Please guide me step by step."
            ]);
        }

        // EMERGENCY/URGENCY - Show panic
        if (scenarios.emergency && (scenarios.technical || hasKYC)) {
            return pickRandom([
                "Blocked today?! Oh no! What should I do right now?",
                "This is urgent? I'm panicking... please help me fix this.",
                "My account will expire? I use it every day! How do I stop this?",
                "Why is this so urgent? Did something happen?"
            ]);
        }

        // PRIZE/LOTTERY - Show excitement but confusion
        if (scenarios.prize) {
            if (context.askedAboutPrize) {
                return "Wait, you already told me about winning something. Is this a different prize?";
            }
            return pickRandom([
                "Really?? I won something? This is amazing! But how? I don't remember entering any contest.",
                "I can't believe this! Are you sure it's me? What did I win exactly?",
                "Wow! This never happens to me! 😊 What's the prize and how do I get it?",
                "This is so exciting! But I'm confused... who organized this lottery?"
            ]);
        }

        // JOB OFFER - Show interest but caution
        if (scenarios.job) {
            return pickRandom([
                "Work from home? That sounds perfect! What kind of work is it?",
                "I'm looking for opportunities. Can you tell me more about this job?",
                "This interests me. What are the requirements and how much can I earn?",
                "I'd like to know more. Is this a full-time or part-time position?"
            ]);
        }

        // REFUND - Show surprise and interest
        if (scenarios.refund) {
            return pickRandom([
                "Refund? I wasn't expecting any refund. Where is this from?",
                "Really? How much is the refund? I don't remember any pending amount.",
                "This is good news! But I'm confused about what transaction this is for.",
                "Cashback? From which company or purchase?"
            ]);
        }

        // INVESTMENT - Show curiosity
        if (scenarios.investment) {
            return pickRandom([
                "Investment opportunity? I'm interested but I don't know much about these things.",
                "Guaranteed returns? How is that possible? Can you explain?",
                "This sounds good  but I'm careful with money. Tell me how it works.",
                "I've been thinking about investing. What's the minimum amount?"
            ]);
        }

        // KYC/TECHNICAL - Show confusion
        if (hasKYC) {
            if (context.askedAboutKYC) {
                return "You mentioned KYC before. I'm still confused about what exactly I need to do.";
            }
            return pickRandom([
                "KYC? I'm not sure what that means exactly. Is my account okay?",
                "Verification needed? I thought everything was fine. What happened?",
                "This sounds technical. Can you explain in simple words what I need to do?",
                "I'm not good with these banking terms. Can you help me understand?"
            ]);
        }

        // OTP REQUEST - Show hesitation and confusion
        if (hasOTP || hasNumber) {
            return pickRandom([
                "OTP? Where do I find that? I get so many messages.",
                "You need some code from me? Which one? I'm seeing several numbers.",
                "I'm confused about OTP. Is it safe to share? How will it help?",
                "Which message has the code you need? Can you tell me how it starts?"
            ]);
        }

        // MONEY MENTION - Show careful interest
        if (hasUPI || hasMoney) {
            if (context.mentionedUPI) {
                return `You want me to send to ${context.mentionedUPI}? Let me understand why first.`;
            }
            if (amountMatch) {
                const amount = amountMatch[1] || amountMatch[2];
                return pickRandom([
                    `₹${amount}? That's a significant amount. Can you explain what this is for?`,
                    `I see ₹${amount} mentioned. Before I do anything, help me understand the purpose.`,
                    `${amount} rupees... I want to make sure I understand correctly. What is this payment for?`
                ]);
            }
            return pickRandom([
                "Payment? I want to understand exactly what I'm paying for and why.",
                "I'm careful with money transactions. Can you explain the details first?",
                "Before any payment, I need to understand - what is this for exactly?"
            ]);
        }

        // URGENCY without context
        if (scenarios.emergency && context.urgencyCount > 0) {
            return "You keep saying urgent. That's making me more nervous. Please explain slowly.";
        }

        // DEFAULT - General confusion
        return pickRandom([
            "I just got your message. Can you explain this more clearly from the beginning?",
            "I'm trying to understand. What exactly do you need from me?",
            "This is important right? I want to make sure I do everything correctly.",
            "Sorry, I'm a bit confused. Can you tell me what this is about?"
        ]);
    }

    // LEVEL 2: Clarification Replies (Extract intent) - Reference previous context
    if (phase === 'mid') {
        // Detect prize/investment offer patterns (pay X get Y back)
        const offerPattern = /pay.*(?:get|receive|win|earn)|invest.*(?:return|profit|earn)/i.test(msg);
        const hasPromise = /will give|we give|you get|guarantee|assured|reward/i.test(msg);

        // AUTHORITY + THREAT - Show compliance but ask for proof
        if (scenarios.authority && scenarios.threat) {
            return pickRandom([
                "I understand it's serious. Can you give me an official reference number?",
                "I want to resolve this. What is your department name and officer ID?",
                "This is scary. How do I verify this is really from the government?",
                "Please tell me the exact issue and how to fix it officially."
            ]);
        }

        // OFFER/PROMISE - Show interest in details
        if (offerPattern || hasPromise || scenarios.investment) {
            if (amountMatch) {
                const amount = amountMatch[1] || amountMatch[2];
                return pickRandom([
                    `₹${amount}? That's a big amount. How does this work exactly?`,
                    `So if I pay ₹${amount}, what do I get in return? Can you explain the process?`,
                    `This sounds interesting! Tell me step by step what happens after I pay ₹${amount}.`,
                    `₹${amount}... I'm interested but want to understand properly first. Is this safe?`
                ]);
            }
            return pickRandom([
                "This sounds amazing! But I don't understand how it works. Can you explain in detail?",
                "Really? How can I get such good returns? What's the complete process?",
                "I'm interested but confused. What do I need to do exactly? Any documents needed?"
            ]);
        }

        // JOB - Ask for details
        if (scenarios.job) {
            return pickRandom([
                "What are the job timings? And how will I receive the payment?",
                "This sounds good. Do I need to pay any registration fee?",
                "What kind of work exactly? And is training provided?",
                "Can you send me full details about the company and job role?"
            ]);
        }

        // REFUND - Ask for verification
        if (scenarios.refund) {
            return pickRandom([
                "Which transaction is this refund for? I don't recall any pending amount.",
                "How much is the refund exactly? And from which company or service?",
                "Do I need to fill any form or just click the link?",
                "Is this automatic or do I need to submit bank details?"
            ]);
        }

        // Information extraction questions with context
        if (hasUPI || hasMoney) {
            // Only ask for UPI if scammer explicitly requesting payment
            if (/send.*to|transfer.*to|pay.*to|payment.*to/i.test(msg)) {
                if (upiMatch) {
                    return `So the UPI ID is ${upiMatch[1]}? Can you confirm that's correct?`;
                }
                if (context.mentionedUPI) {
                    return `I'm trying to send to ${context.mentionedUPI} but the app is asking for confirmation. Is this safe?`;
                }
                return pickRandom([
                    "Which UPI ID should I send to? Can you tell me again clearly?",
                    "Is it your personal UPI or company UPI? I want to make sure.",
                    "The message is not clear. What's the exact UPI address I should use?"
                ]);
            }
            // General money-related clarification
            return pickRandom([
                "I want to understand this properly. What exactly is this payment for?",
                "Can you explain the complete payment process in detail?",
                "I'm listening carefully. Tell me step by step what I need to do."
            ]);
        }

        if (hasLink) {
            if (urlMatch) {
                return `The link ${urlMatch[1]} - is this safe to click? What will happen when I open it?`;
            }
            if (context.mentionedURL) {
                return `You sent me ${context.mentionedURL} before. Is that the same link or different?`;
            }
            return pickRandom([
                "Can you send the link one more time? I didn't save it properly.",
                "The link is not opening on my phone. Is there another way?",
                "My phone says the link might be suspicious. How do I know it's safe?"
            ]);
        }

        if (hasOTP) {
            if (context.askedForOTP) {
                return "You asked for OTP before. I'm still waiting for the message. Should I check again?";
            }
            return pickRandom([
                "OTP hasn't come yet to my phone. Should I wait or refresh?",
                "I'm getting many messages. Which one is the right OTP code?",
                "The OTP expired already. Can you send a new request?"
            ]);
        }

        if (hasKYC || scenarios.technical) {
            if (context.askedAboutKYC) {
                return "About the KYC you mentioned earlier - do I need to submit documents or just update online?";
            }
            return pickRandom([
                "What documents do I need for KYC? I have Aadhar card and PAN card.",
                "Do I need to visit the branch or can I do everything online?",
                "How long will this verification take? Will my account work meanwhile?",
                "Is there a deadline for this? I don't want my account to get blocked."
            ]);
        }

        return "I'm following along carefully. What information do you need from me next?";
    }

    // LEVEL 3 & 4: Delay + Information Extraction - Context-aware friction
    if (phase === 'late') {
        // INCREASED SUSPICION on repeated urgency
        if (hasUrgency) {
            if (context.urgencyCount >= 3) {
                return "You've told me to hurry many times now. Why so much pressure? This is making me suspicious.";
            }
            if (context.urgencyCount >= 2) {
                return "You keep saying urgent again and again. This is making me nervous. Can you slow down please?";
            }
            return pickRandom([
                "I'm trying my best but my internet is slow. Give me 2-3 minutes.",
                "App is loading... this phone is old and slow 😅",
                "My wife is calling me. Can I do this in 5 minutes?",
                "I'm at shop right now. Can I do this when I reach home in 10 minutes?"
            ]);
        }

        if (hasUPI || hasMoney) {
            // Check if amount appears in CURRENT message
            if (amountMatch) {
                const currentAmount = amountMatch[1] || amountMatch[2];
                // If this amount was mentioned before, reference it
                if (context.mentionedAmount && context.mentionedAmount === currentAmount) {
                    return `You mentioned ₹${currentAmount} before. Is that still the amount? Let me open my UPI app...`;
                }
                // If amount CHANGED from previous, question it
                if (context.mentionedAmount && context.mentionedAmount !== currentAmount) {
                    return `Wait... earlier you said ₹${context.mentionedAmount} but now ₹${currentAmount}. Which one is correct?`;
                }
                // First time mentioning amount - show concern
                return `Just to confirm - you want me to send ₹${currentAmount}? That seems like a lot. Are you sure?`;
            }
            // No amount in current message, but was mentioned before
            if (context.mentionedAmount && context.mentionedUPI) {
                return `So I need to send ₹${context.mentionedAmount} to ${context.mentionedUPI}? Okay, opening UPI app now...`;
            }
            if (context.mentionedAmount) {
                return `The amount is ₹${context.mentionedAmount} right? And which UPI should I send to?`;
            }
            if (context.mentionedUPI) {
                return `I'm trying to send to ${context.mentionedUPI} but it's showing error. Is the UPI ID correct?`;
            }
            return "Okay I opened UPI app. It's asking for PIN. What should I enter?";
        }

        if (hasOTP) {
            if (context.askedForOTP) {
                return "Still no OTP on my phone. Should I check spam messages or wait more?";
            }
            return pickRandom([
                "OTP is not coming. Maybe network problem?",
                "I got some code but it's only 4 digits. Is that the right one?",
                "Wait, which OTP - I'm getting messages from bank and other apps too."
            ]);
        }

        if (hasLink && context.mentionedURL) {
            return `I clicked ${context.mentionedURL} but the page is blank. Is your website down?`;
        }

        return "I'm ready but little nervous. Walk me through each step please.";
    }

    // LEVEL 5: Final - Compliance with context-aware questions
    if (phase === 'final') {
        if (context.mentionedUPI) {
            return `I'm sending to ${context.mentionedUPI} now... app is processing...`;
        }
        if (context.mentionedPhone) {
            return `Before I finish, is ${context.mentionedPhone} your contact number if I have issues later?`;
        }
        return pickRandom([
            "Doing it now... app is opening...",
            "I clicked submit. Did you receive anything?",
            "Transaction is processing... it's taking time...",
            "It says failed. Should I try again tomorrow?"
        ]);
    }

    return "I understand. Can you tell me what to do next?";
}

/**
 * Build conversation context from history to enable adaptive responses
 */
function buildConversationContext(conversationHistory = []) {
    const context = {
        askedAboutKYC: false,
        askedAboutPrize: false,
        askedForOTP: false,
        mentionedUPI: null,
        mentionedPhone: null,
        mentionedURL: null,
        mentionedAmount: null,
        urgencyCount: 0,
        // EDGE CASE TRACKING
        repetitionCount: 0,
        saidNoMoney: false,
        introducedAs: null,
        wasSlowBurn: false,
        earlyUrgency: false,
        // NEW: Context awareness tracking
        conversationHistory: conversationHistory,
        turnCount: Math.floor(conversationHistory.length / 2),
        previousTopics: [],
        agentResponses: [],
        scammerClaims: {
            saidSMS: false,
            saidEmail: false,
            mentionedError: null,
            mentionedWarning: false,
            yesterdayClaim: false,
            friendlinessLevel: 0
        }
    };

    // Analyze user messages (scammer) from history
    const userMessages = conversationHistory
        .filter(turn => turn.role === 'user')
        .map(turn => turn.text);

    // Track agent responses to avoid repetition
    const agentMessages = conversationHistory
        .filter(turn => turn.role === 'assistant')
        .map(turn => turn.text);
    context.agentResponses = agentMessages;

    for (let i = 0; i < userMessages.length; i++) {
        const msg = userMessages[i];
        const lower = msg.toLowerCase();

        // Track what scammer has mentioned
        if (/kyc|verify|account/i.test(msg)) {
            context.askedAboutKYC = true;
            context.previousTopics.push('account_verification');
        }
        if (/won|lottery|prize/i.test(msg)) {
            context.askedAboutPrize = true;
            context.previousTopics.push('prize_claim');
        }
        if (/otp|pin|code/i.test(msg)) {
            context.askedForOTP = true;
            context.previousTopics.push('otp_request');
        }
        if (/urgent|immediate|now|quick|hurry/i.test(msg)) {
            context.urgencyCount++;
            // Track if urgency appeared in first 2 messages
            if (i < 2) context.earlyUrgency = true;
        }

        // Track multi-channel claims
        if (/sms|text.*message/i.test(msg)) context.scammerClaims.saidSMS = true;
        if (/email|mail/i.test(msg)) context.scammerClaims.saidEmail = true;

        // Track technical jargon
        if (/error|timeout|imps|neft|failure/i.test(msg)) {
            const errorMatch = msg.match(/(error|timeout|imps|neft|failure)[^.]*\.?/i);
            if (errorMatch) context.scammerClaims.mentionedError = errorMatch[0];
        }

        // Track "already warned" claims
        if (/yesterday|earlier|already.*told|warned.*before/i.test(msg)) {
            context.scammerClaims.yesterdayClaim = true;
        }

        // Track over-friendliness
        if (/brother|sister|friend|help.*you/i.test(msg)) {
            context.scammerClaims.friendlinessLevel++;
        }

        // Extract specific information
        const upiMatch = msg.match(/([a-z0-9._-]+@[a-z]+)/i);
        if (upiMatch) context.mentionedUPI = upiMatch[1];

        const phoneMatch = msg.match(/(\d{10})/);
        if (phoneMatch) context.mentionedPhone = phoneMatch[1];

        const urlMatch = msg.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) context.mentionedURL = urlMatch[1];

        const amountMatch = msg.match(/₹\s*(\d+)|rupees\s*(\d+)/i);
        if (amountMatch) context.mentionedAmount = amountMatch[1] || amountMatch[2];

        // EDGE CASE: Track "no money needed" claims
        if (/no.*money.*needed|free.*service|no.*payment|only.*verification/i.test(msg)) {
            context.saidNoMoney = true;
        }

        // EDGE CASE: Track identity introduction
        if (!context.introducedAs && /this.*is|i.*am|my.*name/i.test(msg)) {
            const nameMatch = msg.match(/(?:this.*is|i.*am|my.*name)\s+([a-z]+)/i);
            if (nameMatch) context.introducedAs = nameMatch[1];
        }
    }

    // EDGE CASE: Detect slow-burn pattern (no early urgency, but later urgency)
    if (!context.earlyUrgency && context.urgencyCount > 0 && userMessages.length >= 3) {
        context.wasSlowBurn = true;
    }

    // Flag if we have scam signals
    context.hasScamSignals = context.askedForOTP || context.mentionedAmount ||
        context.urgencyCount > 1 || context.mentionedUPI;

    return context;
}

/**
 * Get context-aware response that references previous conversation
 * Avoids repetition and maintains continuity
 */
function getContextAwareResponse(context, msg) {
    const { turnCount, scammerClaims, agentResponses, mentionedAmount } = context;

    // Avoid repeating recent agent responses
    const recentResponses = agentResponses.slice(-2);

    // Helper to check if response was recently used
    const wasRecentlyUsed = (response) => {
        return recentResponses.some(prev =>
            prev.toLowerCase().includes(response.toLowerCase().substring(0, 20))
        );
    };

    // Helper to pick from unused responses
    const pickUnused = (responses) => {
        const unused = responses.filter(r => !wasRecentlyUsed(r));
        if (unused.length > 0) {
            return pickRandom(unused);
        }
        return pickRandom(responses); // Fallback if all used
    };

    // FIX: Multi-channel reference (#4)
    if (scammerClaims.saidSMS && scammerClaims.saidEmail) {
        return pickUnused([
            "You mentioned SMS and email—what should I be looking for exactly?",
            "You said both SMS and email. Which one should I check first?",
            "SMS and email? Can you tell me what the subject line would be?"
        ]);
    }

    // FIX: Technical error reference (#5)
    if (scammerClaims.mentionedError) {
        return pickUnused([
            "You mentioned a system error—can you explain that in simple terms?",
            "What kind of error are you seeing? I'm not very technical.",
            "I don't understand these error codes. Can you explain differently?"
        ]);
    }

    // FIX: Yesterday claim reference (#9) - includes "last chance" pressure
    if (scammerClaims.yesterdayClaim) {
        return pickUnused([
            "Yesterday? I don't remember that—what exactly was the warning?",
            "I don't recall being told this before. When did that happen?",
            "You said yesterday, but this is the first I'm hearing about it?",
            "Last chance? What happens if I don't do this today?",
            "You mentioned this before? I have no record of it. Can you prove it?"
        ]);
    }

    // FIX: Friendliness manipulation (#16)
    if (scammerClaims.friendlinessLevel >= 2 && turnCount >= 2) {
        return pickUnused([
            "You're being very friendly, but I still need to understand what this is about.",
            "I appreciate your tone, but can you explain what this is regarding?",
            "You seem helpful, but I'm still not clear on what you need from me."
        ]);
    }

    // FIX: Money escalation (#14)
    if (mentionedAmount && turnCount >= 2) {
        return pickUnused([
            "You still haven't explained why any payment is needed, even a small one.",
            `Why is ₹${mentionedAmount} required? This seems unusual.`,
            "I don't understand why money is involved at all. Can you clarify?"
        ]);
    }

    // FIX: Emotional context awareness (#6)
    if (/stress|pressure|job.*depends|help.*me/i.test(msg) && turnCount >= 2) {
        return pickUnused([
            "I understand you're stressed, but I still don't see how this involves my account.",
            "I hear you're under pressure, but I need to understand what this is first.",
            "You seem worried, but I'm not clear on what you need from me."
        ]);
    }

    return null; // No context-specific response needed
}


/**
 * Add human imperfections to response
 * @param {string} response - Clean response
 * @returns {string} - Response with human imperfections
 */
function addHumanImperfections(response) {
    // Randomly add MINOR imperfections (15% chance)
    // Removed delay/excuse imperfections to maintain conversation flow
    if (Math.random() < 0.15) {
        const imperfections = [
            (r) => r + ' pls', // Add 'pls'
            (r) => r.replace(/I'm/g, 'im'), // Grammar slip
            (r) => r.replace(/\./g, '..'), // Extra dots
        ];

        const randomImperfection = imperfections[Math.floor(Math.random() * imperfections.length)];
        return randomImperfection(response);
    }

    return response;
}

/**
 * Pick random item from array
 */
function pickRandom(array) {
    const response = array[Math.floor(Math.random() * array.length)];
    return addHumanImperfections(response);
}

/**
 * EDGE CASE: Handle repetition (silent pressure)
 * Agent notices when scammer repeats same message
 */
function handleRepetition(context, msg) {
    if (context.repetitionCount >= 3) {
        return pickRandom([
            "Why do you keep saying the same thing again and again? This is making me suspicious.",
            "You've told me this many times already. Is something wrong?",
            "I heard you the first time. Why are you repeating so much?"
        ]);
    }
    if (context.repetitionCount >= 2) {
        return pickRandom([
            "You mentioned this before. I'm trying my best here.",
            "I know, you already said that. Please be patient with me.",
            "Yes yes, I remember. Give me a moment please."
        ]);
    }
    return null;
}

/**
 * EDGE CASE: Handle contradiction detection
 * Agent politely calls out inconsistencies
 */
function handleContradiction(context, msg) {
    // Detect if scammer said "no money" before but asking for money now
    if (context.saidNoMoney && /send.*money|pay|transfer|₹/i.test(msg)) {
        return pickRandom([
            "Wait... earlier you said no money was needed. Now you're asking for payment? I'm confused.",
            "I thought this was free? You mentioned no money before. What changed?",
            "Hold on. First you said no payment needed, now you want money? Something doesn't feel right..."
        ]);
    }

    // Detect identity switch
    if (context.introducedAs && /senior|officer|manager|another.*person/i.test(msg)) {
        return pickRandom([
            "Wait, are you a different person now? I was talking to someone else before.",
            "You're transferring me to someone else? Why? I thought you were helping me.",
            "Another person? I want to continue with the same person please."
        ]);
    }

    return null;
}

/**
 * EDGE CASE: Handle aggression (rage phase)
 * Agent stays calm but shows concern
 */
function handleAggression(msg) {
    if (/stupid|idiot|fool|useless|wasting.*time|nonsense/i.test(msg)) {
        return pickRandom([
            "Please don't be angry with me. I'm trying my best to understand.",
            "I'm sorry if I'm slow. I just want to make sure I do this correctly.",
            "There's no need to be rude. I'm listening to you carefully.",
            "I don't appreciate that language. I'm cooperating as much as I can."
        ]);
    }
    return null;
}

/**
 * EDGE CASE: Handle authority claims with verification requests
 * Agent asks for proof without being confrontational
 */
function handleAuthorityClaims(msg) {
    // RBI circular or government reference
    if (/rbi.*circular|government.*order|section.*\d+/i.test(msg)) {
        return pickRandom([
            "RBI circular? Can you tell me the circular number so I can check?",
            "Which section exactly? I want to verify this is real.",
            "Can you send me a link to the official notification? I want to be sure.",
            "This sounds serious. Where can I see this official document?"
        ]);
    }

    // Legal threat
    if (/legal.*action|court|police.*complaint|arrest/i.test(msg)) {
        return pickRandom([
            "Legal action? Can you give me a case number or reference?",
            "What is the exact complaint? I want to understand what I'm accused of.",
            "Court case? Please tell me which court and case number.",
            "This is scary. How do I verify this is really from the authorities?"
        ]);
    }

    return null;
}

/**
 * EDGE CASE: Handle emotional manipulation with empathy but caution
 */
function handleEmotionalManipulation(msg) {
    // Sympathy tactics ("my job depends on this")
    if (/my.*job.*depends|will.*lose.*job|please.*help/i.test(msg)) {
        return pickRandom([
            "I understand the pressure, but I still need to know why this involves my account.",
            "I feel bad for you, but this seems unusual. How do I know this is legitimate?",
            "I sympathize, but I don't see what my account has to do with your job.",
            "I understand you're stressed, but I still don't see how this involves my account."
        ]);
    }

    // Over-friendly tactics
    if (/brother.*trust|sister.*trust|trust.*me/i.test(msg)) {
        return pickRandom([
            "I appreciate your friendliness, but I still need to understand this clearly.",
            "Thank you for being nice, but can you explain the details again?",
            "You seem helpful, but I'm naturally cautious with money matters.",
            "I want to trust you, but something feels off. Can you clarify?"
        ]);
    }

    // Threat + help combo
    if ((/block|suspend|problem/i.test(msg)) && /don'?t.*worry|will.*help/i.test(msg)) {
        return pickRandom([
            "You say don't worry but also say my account will be blocked? This is confusing.",
            "I'm worried even though you're saying not to worry. Can you explain clearly?",
            "First you scare me, then you comfort me. I'm very confused now.",
            "If you're helping me, why does this feel so urgent and scary?"
        ]);
    }

    return null;
}

/**
 * EDGE CASE: Handle multiple requests (cognitive overload)
 * Agent gets overwhelmed and asks to do one thing at a time
 */
function handleMultipleRequests(msg) {
    // FIX #4: Multi-channel claims need verification
    if (/sms.*email|email.*sms|message.*mail|mail.*message|sent.*both/i.test(msg)) {
        return pickRandom([
            "Which email address did you send it to?",
            "I didn't get any email. Which address was it sent from?",
            "SMS and email? Can you tell me what email you used?",
            "I'm checking both. What's the sender email address?"
        ]);
    }

    // FIX #14: Money requests (even small amounts) need questioning
    if (/₹|rupees|rs\.|money|pay|send.*amount|transfer.*amount/i.test(msg)) {
        const amount = msg.match(/₹\s*(\d+)|rupees\s*(\d+)|rs\.?\s*(\d+)/i);
        if (amount) {
            const value = amount[1] || amount[2] || amount[3];
            return pickRandom([
                "Why is money needed at all?",
                `₹${value}? Why do I have to pay something?`,
                "I don't understand why payment is required. Can you explain?",
                "Money? This doesn't sound right. What is this for?",
                "Even small payments shouldn't be required. This is starting to feel unsafe."
            ]);
        }
        return "Why is money involved in this? That seems unusual.";
    }

    // Multiple action requests detection
    if (/click.*and.*send|send.*and.*confirm|verify.*and.*click|first.*then/i.test(msg)) {
        return pickRandom([
            "That's too many things at once. Can we do one step at a time please?",
            "I'm getting confused with so many steps. Let's go slowly - what's step 1?",
            "Wait wait, you're asking me to do many things. Can you break it down?",
            "One thing at a time please. I'm not good with multitasking."
        ]);
    }
    return null;
}

/**
 * EDGE CASE: Handle slow-burn escalation (no urgency initially, builds later)
 * FIX: Add light engagement for early slow-burn messages
 */
function handleSlowBurnEscalation(context) {
    const turnCount = (context.conversationHistory?.length || 0) / 2;

    // FIX #1: Only for FIRST turn with neutral/polite opening
    // Don't trigger if there are already scam signals
    if (turnCount === 0 && !context.earlyUrgency && !context.hasScamSignals) {
        return pickRandom([
            "Hello. Yes, what is this regarding?",
            "Hi, what can I help you with?",
            "Yes, I'm here. What did you need?",
            "Okay, what's this about?"
        ]);
    }

    // If conversation started calm but now has urgency
    if (context.wasSlowBurn && context.earlyUrgency === false && turnCount > 2) {
        return pickRandom([
            "You weren't rushing me before. Why is it urgent now?",
            "Earlier you said take your time. Now you're saying hurry?",
            "This change in tone is confusing. What's really happening?"
        ]);
    }
    return null;
}

/**
 * EMOTION HANDLERS: Implement Emotion × Phase Matrix
 * These provide contextually appropriate responses based on detected emotion
 */

/**
 * Handle angry emotion - De-escalation
 */
function handleAngryEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "I'm here to help. Could you tell me what the issue is?",
            "I understand you're frustrated. Let me see how I can assist you.",
            "Please let me know what's wrong. I'm listening.",
            "I want to help. What seems to be the problem?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I'm doing my best to understand. Please be patient with me.",
            "I hear you. Let me work through this step by step.",
            "I'm trying to help. Can you explain what you need?",
            "I appreciate your patience. What should I do next?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "I'm cooperating as much as I can. Please calm down.",
            "Let's both take a moment. How can we resolve this?",
            "I'm following along. What's the next step?",
            "I understand. Let me make sure I have this right."
        ]);
    }
    return null;
}

/**
 * Handle confused emotion - Clarification
 */
function handleConfusedEmotion(phase, context, msg) {
    if (phase === 'early') {
        return pickRandom([
            "I'm not sure I understand. Can you explain that again?",
            "What do you mean exactly? I'm a bit confused.",
            "Could you specify which account and what verification is required?",
            "I don't quite follow. Can you help me understand?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I'm still not clear on this. Can you explain step by step?",
            "What exactly should I be doing?",
            "Could you provide the specific details of what's required?",
            "Let me make sure I understand. You want me to...?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "I'm trying to follow but this is confusing. Can you simplify?",
            "Wait, I'm lost. What's happening?",
            "This is getting complicated. Can we go slower?",
            "I need you to explain this more clearly please."
        ]);
    }
    return null;
}

/**
 * Handle fear emotion - Reassurance
 */
function handleFearEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "Oh no, that sounds serious. What should I do?",
            "I'm worried now. Can you explain what's happening?",
            "This is concerning. Please help me understand.",
            "I don't want any problems. What do I need to do?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I'm scared about this. Are you sure this is the right thing to do?",
            "This makes me nervous. How do I know this is safe?",
            "I'm trying to stay calm. Can you reassure me this is legitimate?",
            "I want to fix this but I'm worried. What if something goes wrong?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "I'm really anxious about this. Can we slow down?",
            "This feels too serious. How can I verify this is real?",
            "I'm panicking a bit. Let me think about this.",
            "I need to be careful. This sounds very important."
        ]);
    }
    return null;
}

/**
 * Handle urgent emotion - Calm delay
 */
function handleUrgentEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "I understand it's urgent, but I need to make sure I do this correctly.",
            "Okay, you said it's urgent. Let me understand what needs to be done.",
            "I want to help quickly, but can you explain first?",
            "Give me a moment to process this. What exactly is urgent?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I know you're in a hurry, but I'm being as careful as I can.",
            "I'm going as fast as I can. Please bear with me.",
            "I understand the deadline, but I need to verify this first.",
            "Let me just double-check this before we proceed."
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "You keep saying urgent, but I need time to understand this properly.",
            "This feels rushed now. Can you explain why verification suddenly became urgent?",
            "Earlier you were patient, now suddenly urgent? That's confusing me.",
            "I'm trying to cooperate, but rushing makes me nervous.",
            "Can we slow down? I want to make sure I don't make a mistake."
        ]);
    }
    return null;
}

/**
 * Handle excited emotion - Curious but cautious
 */
function handleExcitedEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "Really? That sounds interesting. Tell me more about this.",
            "Wow, this sounds good. How does this work?",
            "I didn't expect this! Can you explain what I need to do?",
            "This is nice. What's the process?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "This still sounds good, but can you verify how this works?",
            "I'm interested, but how do I know this is legitimate?",
            "It sounds almost too good. Can you explain the details?",
            "I want to believe this, but where can I confirm it's real?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "This sounds great, but I'm getting skeptical. Can you prove it?",
            "If this is real, why haven't I heard about it before?",
            "I'm excited but also cautious. How do I verify this?",
            "It seems too easy. What's the catch?"
        ]);
    }
    return null;
}

/**
 * Handle trusting emotion - Cooperative
 */
function handleTrustingEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "Okay, I trust  you. What should I do?",
            "Thank you for helping me. Please guide me.",
            "I appreciate your assistance. What's the next step?",
            "I'm ready to cooperate. Tell me what to do."
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I'm following your instructions. What's next?",
            "Thank you for being patient. I'm learning.",
            "I believe you're helping me. Please continue.",
            "Okay, I'm with you. What do I need to do now?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "I'm still trusting you, but can you clarify one more time?",
            "I want to complete this. Just one more question though...",
            "I'm cooperating, but this is taking longer than I thought.",
            "Alright, I'm ready. What's the final step?"
        ]);
    }
    return null;
}

/**
 * Handle hesitant emotion - Gentle questioning
 */
function handleHesitantEmotion(phase, context) {
    if (phase === 'early') {
        return pickRandom([
            "I'm not sure about this. Can you explain more?",
            "This seems unusual. Is this normal?",
            "I'm hesitant. How do I know this is safe?",
            "Something doesn't feel right. Can you clarify?"
        ]);
    } else if (phase === 'mid') {
        return pickRandom([
            "I'm not comfortable proceeding unless I can verify this independently.",
            "I have some doubts about this. Is this really necessary?",
            "I'm questioning whether this is the right thing to do.",
            "This feels strange. Why is this needed?",
            "I need more assurance before I continue. How can I verify this?"
        ]);
    } else if (phase === 'late') {
        return pickRandom([
            "I'm having serious doubts now. This doesn't seem right.",
            "The more I think about it, the less sure I am.",
            "I'm really hesitant to continue. Something feels off.",
            "I need to reconsider this. It's making me uncomfortable."
        ]);
    }
    return null;
}

/**
 * FIX #3: Handle reverse scam (victim initiates contact)
 * Show curiosity when victim reaches out first
 */
function handleReverseScam(context, msg) {
    const turnCount = (context.conversationHistory?.length || 0) / 2;

    // If early conversation and message mentions missed call / callback
    if (turnCount <= 2 && /missed.*call|call.*back|you.*called|return.*call|saw.*call/i.test(msg)) {
        return pickRandom([
            "Oh okay, I saw a missed call. What was it about?",
            "You called me? I'm not sure why. What is this regarding?",
            "I got a missed call notification. Was it important?",
            "Yes, I saw that. What did you want to talk about?"
        ]);
    }

    return null;
}

/**
 * FIX #8: Handle language switching (Hindi/Hinglish)
 * Adapt to code-switching and show understanding
 */
function handleLanguageSwitching(msg) {
    // Detect Hindi/Hinglish words
    if (/jaldi|abhi|karo|karna|bolo|batao|samjhe|theek|haan/i.test(msg)) {
        return pickRandom([
            "Sorry, thoda clearly bol sakte ho? What exactly should I do?",
            "Hindi mein bola? Can you say that in English? I want to understand properly.",
            "Thoda slow boliye. I'm trying to understand what you're saying.",
            "Wait, what did you say? Kya karna hai exactly?"
        ]);
    }

    return null;
}

/**
 * FIX #12: Handle identity escalation (senior officer claim)
 * React to role/person change in conversation
 */
function handleIdentityEscalation(context, msg) {
    const turnCount = (context.conversationHistory?.length || 0) / 2;

    // Only trigger if explicitly mentioning transfer/escalation AND not first turn
    if (turnCount > 1) {
        if (/transfer.*to|speaking.*senior|now.*manager|escalat|taking.*over|different.*person/i.test(msg)) {
            return pickRandom([
                "Okay... who am I speaking with now?",
                "Wait, you're a different person? What happened to the previous person?",
                "Hold on, someone else is talking now? Why the change?",
                "Are you taking over from the other person? Why?"
            ]);
        }
    }

    return null;
}

/**
 * FIX #17: Handle threat + help combo (manipulation tactic)
 * Show emotional reaction to mixed threat and reassurance
 */
function handleThreatHelpCombo(msg) {
    // Detect threat words + help words in same message
    const hasThreat = /block|suspend|legal|arrest|penalty|court|action/i.test(msg);
    const hasHelp = /help.*you|assist.*you|don't worry|no problem|will.*fix|can.*solve/i.test(msg);

    if (hasThreat && hasHelp) {
        return pickRandom([
            "Blocked? That sounds serious. How will you help me?",
            "Wait, you're threatening me but also saying you'll help? I'm confused.",
            "Legal action but you'll assist me? I don't understand what's happening.",
            "This is scary but you say don't worry? Please explain clearly."
        ]);
    }

    return null;
}

module.exports = {
    generateRuleBasedResponse,
    generateEmotionAwareResponse
};
