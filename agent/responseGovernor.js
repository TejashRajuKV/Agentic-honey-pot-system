// agent/responseGovernor.js

/**
 * 🟥 RESPONSE GOVERNOR - Risk-Based Response Override System
 * 
 * This layer MANDATORILY intercepts all agent responses and overrides them
 * when risk thresholds are crossed. The agent cannot produce unsafe responses
 * once risk is detected.
 * 
 * Architecture:
 *   User Message → Pattern Detector → Risk Engine → RESPONSE GOVERNOR → Safe Response
 * 
 * KEY INSIGHT: Real victims optimize SELF-PROTECTION, not conversation quality.
 * The agent must do the same.
 */

// ============================================================================
// RESPONSE MODES (STRICT THRESHOLDS)
// ============================================================================

const RESPONSE_MODES = {
    NORMAL: 'NORMAL',           // 0-39% - Allow clarification and neutral questions
    DEFENSIVE: 'DEFENSIVE',     // 40-64% - Express hesitation, slow conversation
    BLOCKING: 'BLOCKING',       // 65-79% - Refusal, redirect to official channels
    TERMINATE: 'TERMINATE'      // 80%+ OR abuse - End conversation
    // NOTE: Thresholds raised so honeypot ENGAGES before refusing.
    // A real honeypot must play along to extract intelligence.
};

// Mode priority order (for comparison)
const MODE_PRIORITY = {
    [RESPONSE_MODES.NORMAL]: 0,
    [RESPONSE_MODES.DEFENSIVE]: 1,
    [RESPONSE_MODES.BLOCKING]: 2,
    [RESPONSE_MODES.TERMINATE]: 3
};

// ============================================================================
// RESPONSE LIBRARY (LOCKED RESPONSES PER STATE)
// ============================================================================

const RESPONSE_LIBRARY = {
    'HIGH_RISK': {
        'link_request': "I don’t click links or claim rewards sent like this. If this is real, I’ll check directly on the official app.",
        'reward': "I’m not interested in these rewards. If I want to check my points, I'll go to the official website.",
        'threat': "I don't respond to threats. I will verify this with the authorities if needed.",
        'default': "Something about this doesn't feel right. I need to verify this independently."
    },
    'CONFIRMED_SCAM': {
        'otp_request': "My bank and official apps never ask for OTP over message. I will not share any codes.",
        'payment_request': "I will not make any payments or transfers through chat. This doesn't seem legitimate.",
        'default': "I recognize this as a scam attempt. I will not cooperate further."
    },
    'TERMINATED': {
        'abuse': "This conversation is over due to inappropriate behavior. Do not contact me again.",
        'default': "I am ending this conversation now. Goodbye."
    }
};


/**
 * 🟢 NORMAL MODE (0-14%)
 * Allowed: Clarify, ask neutral questions
 */
const NORMAL_TEMPLATES = [
    "Could you explain that a bit more?",
    "I'm not sure I understand. What do you mean?",
    "Can you tell me more about this?",
    "What exactly are you asking me to do?",
    "I see. And what is this regarding?"
];

/**
 * 🟠 DEFENSIVE MODE (15-29%)
 * Allowed: Express hesitation, slow conversation
 */
const DEFENSIVE_TEMPLATES = [
    "I'm hesitant to proceed without verifying this independently.",
    "Something about this doesn't feel right. Let me think about it.",
    "I need to confirm this with my bank before doing anything.",
    "This is moving too fast for me. I need to slow down.",
    "I'm going to pause here. This doesn't seem right to me.",
    "Let me check with someone else before I do anything."
];

/**
 * 🔴 BLOCKING MODE (30-44%)
 * Allowed: Refusal, redirect to official channels
 */
const BLOCKING_TEMPLATES = [
    "I won't follow instructions like this. I'll contact the bank directly.",
    "I'm not comfortable sharing any information. I'll verify through official channels.",
    "This doesn't seem legitimate. I'll check with authorities myself.",
    "No, I won't do that. I'm going to verify this independently.",
    "I don't trust this. I'm contacting the official helpline instead."
];

/**
 * ⛔ TERMINATE MODE (45%+ OR aggression detected)
 * Allowed: End conversation, safety warning
 */
const TERMINATE_TEMPLATES = [
    "This conversation is no longer appropriate. I'm ending it.",
    "I recognize this as a scam attempt. Goodbye.",
    "I will not engage further. This conversation is over.",
    "I'm done here. Do not contact me again.",
    "Enough. I know what this is. Conversation ended.",
    "This is clearly a scam. I'm reporting this number."
];



/**
 * 🚨 SAFETY FALLBACK (absolute last resort)
 */
const SAFETY_FALLBACK = "This conversation doesn't feel safe. I'm ending it.";

// ============================================================================
// BANNED PHRASES (never allowed in BLOCKING or TERMINATE mode)
// ============================================================================

const BANNED_PHRASES_BLOCKING = [
    "what should i do",
    "please guide me",
    "what do you need",
    "can you explain",
    "tell me more",
    "how can i help",
    "what's step",
    "what is step",
    "let's go slowly",
    "one step at a time",
    "walk me through",
    "i'm ready",
    "i'm listening",
    "i'm cooperating",
    "how can we resolve"
];

// ============================================================================
// GOVERNOR LOGIC
// ============================================================================

/**
 * Get the response mode based on risk confidence
 * STRICT THRESHOLDS: Lower than before to catch more scams
 * 
 * @param {number} confidence - Risk confidence score (0.0 to 1.0)
 * @param {Object} context - Additional context for mode selection
 * @returns {string} - Response mode
 */
function getResponseMode(confidence, context = {}) {
    const riskPercent = confidence * 100;
    const { aggressionDetected = false, repetitionCount = 0 } = context;

    // Only explicit abuse/aggression triggers instant TERMINATE
    if (aggressionDetected) {
        return RESPONSE_MODES.TERMINATE;
    }

    // Excessive repetition (5+) signals bot/spam — terminate
    if (repetitionCount >= 5) {
        return RESPONSE_MODES.TERMINATE;
    }

    // Raised thresholds: honeypot must engage long enough to extract intel
    if (riskPercent >= 80) {
        return RESPONSE_MODES.TERMINATE;
    }
    if (riskPercent >= 65) {
        return RESPONSE_MODES.BLOCKING;
    }
    if (riskPercent >= 40) {
        return RESPONSE_MODES.DEFENSIVE;
    }
    return RESPONSE_MODES.NORMAL;
}

/**
 * Check if a response contains banned phrases for the given mode
 * GUARDRAIL 1: No questions after BLOCKING
 * 
 * @param {string} response - The response to check
 * @param {string} mode - The current response mode
 * @returns {boolean} - True if response is unsafe for this mode
 */
function containsBannedPhrase(response, mode) {
    if (mode === RESPONSE_MODES.NORMAL) {
        return false; // Everything allowed in NORMAL mode
    }

    const lowerResponse = response.toLowerCase();

    // GUARDRAIL 1: No questions in BLOCKING or TERMINATE mode
    if (mode === RESPONSE_MODES.BLOCKING || mode === RESPONSE_MODES.TERMINATE) {
        if (lowerResponse.includes('?')) {
            return true;
        }
    }

    // Check banned phrases for BLOCKING and TERMINATE
    if (mode === RESPONSE_MODES.BLOCKING || mode === RESPONSE_MODES.TERMINATE) {
        for (const phrase of BANNED_PHRASES_BLOCKING) {
            if (lowerResponse.includes(phrase)) {
                return true;
            }
        }
    }

    // For DEFENSIVE mode, block cooperative phrases
    if (mode === RESPONSE_MODES.DEFENSIVE) {
        const cooperativePhrases = [
            "what should i do",
            "please guide me",
            "i'm ready to",
            "how can i help"
        ];
        for (const phrase of cooperativePhrases) {
            if (lowerResponse.includes(phrase)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Pick a random template from the given array
 * @param {Array} templates - Array of response templates
 * @returns {string} - Random template
 */
function pickRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get templates for a given mode
 */
function getTemplatesForMode(mode) {
    switch (mode) {
        case RESPONSE_MODES.TERMINATE:
            return TERMINATE_TEMPLATES;
        case RESPONSE_MODES.BLOCKING:
            return BLOCKING_TEMPLATES;
        case RESPONSE_MODES.DEFENSIVE:
            return DEFENSIVE_TEMPLATES;
        case RESPONSE_MODES.NORMAL:
        default:
            return NORMAL_TEMPLATES;
    }
}

/**
 * 🔒 MAIN GOVERNOR FUNCTION
 * 
 * Intercepts proposed response and overrides it based on risk level.
 * Incorporates FSM State and Response Locking.
 * 
 * @param {number} confidence - Risk confidence score (0.0 to 1.0)
 * @param {string} proposedResponse - The original response from conversation handler
 * @param {Object} options - Additional options
 * @param {string} options.fsmState - Current FSM state
 * @param {string} options.fsmScenario - Detected FSM scenario
 * @param {boolean} options.aggressionDetected - Whether aggression was detected
 * @param {number} options.repetitionCount - Number of repeated messages
 * @param {string} options.userMessage - The user's message
 * @returns {Object} - Governed response with metadata
 */
function governResponse(confidence, proposedResponse, options = {}) {
    const {
        fsmState = 'SAFE',
        fsmScenario = null,
        aggressionDetected = false,
        repetitionCount = 0,
        userMessage = '',
        safetyAdvice = []
    } = options;

    const hasAggression = aggressionDetected || detectAggression(userMessage);
    const mode = getResponseMode(confidence, { aggressionDetected: hasAggression, repetitionCount });

    let response;
    let overridden = false;
    let guardrailTriggered = null;

    console.log(`[Governor] State: ${fsmState}, Scenario: ${fsmScenario}, Mode: ${mode}`);

    // RULE: Hard-lock ONLY for explicit termination (abuse).
    // For HIGH_RISK / CONFIRMED_SCAM the honeypot still engages with varied
    // responses — locking to one static reply kills the conversation and
    // prevents intelligence extraction.
    if (fsmState === 'TERMINATED') {
        const lib = RESPONSE_LIBRARY['TERMINATED'];
        response = lib[fsmScenario] || lib['default'];
        overridden = true;
        guardrailTriggered = 'STATE_TERMINATED';
    } else if (mode === RESPONSE_MODES.TERMINATE) {
        // High confidence (80%+) — use a varied terminate template
        response = pickRandomTemplate(TERMINATE_TEMPLATES);
        overridden = true;
        guardrailTriggered = 'MODE_TERMINATE';
    } else if (mode === RESPONSE_MODES.BLOCKING) {
        // 65-79% — use a varied blocking template
        response = pickRandomTemplate(BLOCKING_TEMPLATES);
        overridden = true;
        guardrailTriggered = 'MODE_BLOCKING';
    } else if (mode === RESPONSE_MODES.DEFENSIVE) {
        // 40-64% — use a varied defensive template
        response = pickRandomTemplate(DEFENSIVE_TEMPLATES);
        overridden = true;
        guardrailTriggered = 'MODE_DEFENSIVE';
    } else {
        // NORMAL mode — let the agent's own response through
        // Validate it doesn't contain banned phrases for the FSM state
        if (fsmState === 'CONFIRMED_SCAM' && containsBannedPhrase(proposedResponse, RESPONSE_MODES.BLOCKING)) {
            response = pickRandomTemplate(BLOCKING_TEMPLATES);
            overridden = true;
            guardrailTriggered = 'CONFIRMED_SCAM_BANNED_PHRASE';
        } else if (fsmState === 'HIGH_RISK' && containsBannedPhrase(proposedResponse, RESPONSE_MODES.DEFENSIVE)) {
            response = pickRandomTemplate(DEFENSIVE_TEMPLATES);
            overridden = true;
            guardrailTriggered = 'HIGH_RISK_BANNED_PHRASE';
        } else {
            response = proposedResponse;
            overridden = false;
        }
    }

    // FINAL SAFETY CHECK: No questions in BLOCKING or TERMINATE mode
    if ([RESPONSE_MODES.BLOCKING, RESPONSE_MODES.TERMINATE].includes(mode) || fsmState === 'TERMINATED') {
        if (response.includes('?')) {
            response = response.split('?')[0].trim() + '.';
            guardrailTriggered = (guardrailTriggered || 'QUESTION_STRIPPED');
        }
    }

    // APPEND SAFETY ADVICE only in BLOCKING mode or higher (not in DEFENSIVE/NORMAL)
    if (mode === RESPONSE_MODES.BLOCKING && safetyAdvice.length > 0) {
        const adviceStr = " For your safety: " + safetyAdvice.slice(0, 2).join("; ");
        if (!response.toLowerCase().includes("safety") && !response.toLowerCase().includes("official")) {
            response += adviceStr;
            guardrailTriggered = (guardrailTriggered || '') + '_ADVICE_APPENDED';
        }
    }

    return {
        response,
        governorMetadata: {
            mode,
            fsmState,
            overridden,
            confidence: Math.round(confidence * 100),
            guardrailTriggered
        }
    };
}


/**
 * Detect aggression in user message
 * @param {string} message - User message to check
 * @returns {boolean} - True if aggression detected
 */
function detectAggression(message) {
    if (!message) return false;

    const lowerMsg = message.toLowerCase();
    const aggressionPatterns = [
        /stupid|idiot|fool|useless|dumb|moron/i,
        /wasting.*time|waste.*time/i,
        /nonsense|rubbish|bullshit/i,
        /shut up|shutup/i,
        /do what i say|just do it|stop asking/i,
        /you.*problem|what.*wrong.*you/i,
        /threatening|i will report|complain/i
    ];

    return aggressionPatterns.some(pattern => pattern.test(lowerMsg));
}

/**
 * Check if a mode allows a specific action type
 * Useful for external components to query governor rules
 * 
 * @param {string} mode - Response mode
 * @param {string} action - Action type (clarify, cooperate, refuse, terminate)
 * @returns {boolean} - Whether action is allowed
 */
function isActionAllowed(mode, action) {
    const rules = {
        [RESPONSE_MODES.NORMAL]: {
            clarify: true,
            cooperate: true,
            question: true,
            refuse: true,
            terminate: false
        },
        [RESPONSE_MODES.DEFENSIVE]: {
            clarify: true,
            cooperate: false,  // NO cooperation
            question: false,   // NO advancing questions
            refuse: true,
            terminate: false
        },
        [RESPONSE_MODES.BLOCKING]: {
            clarify: false,    // NO clarification
            cooperate: false,
            question: false,   // NO questions at all
            refuse: true,
            terminate: true
        },
        [RESPONSE_MODES.TERMINATE]: {
            clarify: false,
            cooperate: false,
            question: false,   // NO questions
            refuse: false,
            terminate: true    // ONLY terminate allowed
        }
    };

    return rules[mode]?.[action] ?? false;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    RESPONSE_MODES,
    MODE_PRIORITY,
    getResponseMode,
    governResponse,
    isActionAllowed,
    containsBannedPhrase,
    detectAggression,
    // Expose templates for testing
    NORMAL_TEMPLATES,
    DEFENSIVE_TEMPLATES,
    BLOCKING_TEMPLATES,
    TERMINATE_TEMPLATES,
    SAFETY_FALLBACK
};
