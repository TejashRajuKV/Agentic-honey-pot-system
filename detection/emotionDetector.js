// detection/emotionDetector.js

/**
 * Emotion Handling Layer
 * Detects emotional tone in messages using rule-based keyword matching
 * 
 * Key Principle: Emotion influences TONE, not RISK SCORING
 */

/**
 * 8 Emotion Categories
 */
const EMOTION_CATEGORIES = {
    NEUTRAL: 'neutral',       // Normal conversation
    CONFUSED: 'confused',     // Doesn't understand
    FEAR: 'fear',             // Threatened, panicking
    URGENT: 'urgent',         // Pressured, rushed
    ANGRY: 'angry',           // Insulting, aggressive
    EXCITED: 'excited',       // Prize, opportunity
    TRUSTING: 'trusting',     // Believes authority
    HESITANT: 'hesitant'      // Doubt, caution
};

/**
 * Emotion detection patterns
 */
const EMOTION_PATTERNS = {
    fear: {
        keywords: /blocked|suspended|legal|court|arrest|penalty|fine|jail|police|action|case|complaint|deactivate|expire|terminate/i,
        weight: 0.8
    },
    urgent: {
        keywords: /urgent|immediately|now|quick|fast|hurry|asap|today|last chance|limited time|deadline|expires|final/i,
        weight: 0.7
    },
    excited: {
        keywords: /won|congratulations|reward|prize|gift|selected|winner|lucky|bonus|cashback|free|earn/i,
        weight: 0.6
    },
    angry: {
        keywords: /useless|idiot|waste|wasting|nonsense|stupid|fool|ridiculous|pathetic|slow|dumb/i,
        weight: 0.9
    },
    confused: {
        keywords: /not sure|confused|don't understand|what is|what does|explain|clarify|don't know|unclear|huh|what/i,
        weight: 0.5
    },
    trusting: {
        keywords: /yes sir|ok sir|will do|understood|thank you|grateful|appreciate|help me|guide me|tell me what to do/i,
        weight: 0.4
    },
    hesitant: {
        keywords: /but|however|wait|hold on|not comfortable|suspicious|seems odd|not right|unusual|strange|doubt/i,
        weight: 0.6
    }
};

/**
 * Detect emotion from message
 * @param {string} message - User message
 * @param {Array} emotionHistory - Previous emotions in this session
 * @returns {Object} - { emotion, intensity, confidence }
 */
function detectEmotion(message, emotionHistory = []) {
    const msg = message.toLowerCase();

    // Track scores for each emotion
    const scores = {};

    // Test against all emotion patterns
    for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
        if (pattern.keywords.test(msg)) {
            scores[emotion] = pattern.weight;
        }
    }

    // If multiple emotions detected, pick strongest
    if (Object.keys(scores).length > 0) {
        const detectedEmotion = Object.keys(scores).reduce((a, b) =>
            scores[a] > scores[b] ? a : b
        );

        // Calculate intensity based on history
        const intensity = calculateIntensity(detectedEmotion, emotionHistory);

        return {
            emotion: detectedEmotion,
            intensity: intensity,
            confidence: scores[detectedEmotion]
        };
    }

    // Default to neutral
    return {
        emotion: EMOTION_CATEGORIES.NEUTRAL,
        intensity: 0,
        confidence: 1.0
    };
}

/**
 * Calculate emotion intensity based on repetition
 * Emotions intensify if repeated in recent history
 */
function calculateIntensity(currentEmotion, emotionHistory) {
    if (!emotionHistory || emotionHistory.length === 0) {
        return 0.3; // Base intensity
    }

    // Check last 3 emotions
    const recentEmotions = emotionHistory.slice(-3);
    const repetitionCount = recentEmotions.filter(e => e === currentEmotion).length;

    // Intensity increases with repetition (max 1.0)
    const baseIntensity = 0.3;
    const intensityIncrease = repetitionCount * 0.25;

    return Math.min(baseIntensity + intensityIncrease, 1.0);
}

/**
 * Get emotion-specific response hints
 * These guide the reply generator on tone
 */
function getEmotionResponseHints(emotion, phase) {
    const hints = {
        angry: {
            early: { tone: 'calm', action: 'de-escalate', priority: 'high' },
            mid: { tone: 'patient', action: 'redirect', priority: 'high' },
            late: { tone: 'firm_but_polite', action: 'maintain_calm', priority: 'high' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        confused: {
            early: { tone: 'helpful', action: 'clarify', priority: 'medium' },
            mid: { tone: 'patient', action: 'explain', priority: 'medium' },
            late: { tone: 'simple', action: 'simplify', priority: 'medium' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        fear: {
            early: { tone: 'reassuring', action: 'comfort', priority: 'medium' },
            mid: { tone: 'calm', action: 'slow_down', priority: 'medium' },
            late: { tone: 'steady', action: 'delay', priority: 'medium' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        urgent: {
            early: { tone: 'calm', action: 'delay', priority: 'high' },
            mid: { tone: 'deliberate', action: 'slow_process', priority: 'high' },
            late: { tone: 'questioning', action: 'buy_time', priority: 'high' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        excited: {
            early: { tone: 'curious', action: 'question', priority: 'medium' },
            mid: { tone: 'cautious', action: 'verify', priority: 'medium' },
            late: { tone: 'skeptical', action: 'probe', priority: 'high' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        trusting: {
            early: { tone: 'cooperative', action: 'engage', priority: 'low' },
            mid: { tone: 'helpful', action: 'assist', priority: 'low' },
            late: { tone: 'careful', action: 'verify', priority: 'medium' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        hesitant: {
            early: { tone: 'gentle', action: 'encourage', priority: 'low' },
            mid: { tone: 'patient', action: 'address_concerns', priority: 'medium' },
            late: { tone: 'questioning', action: 'probe', priority: 'high' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        },
        neutral: {
            early: { tone: 'normal', action: 'respond', priority: 'low' },
            mid: { tone: 'normal', action: 'respond', priority: 'low' },
            late: { tone: 'normal', action: 'respond', priority: 'low' },
            final: { tone: 'neutral', action: 'wrap_up', priority: 'low' }
        }
    };

    return hints[emotion]?.[phase] || hints.neutral.early;
}

/**
 * Determine if emotion should override scam-based responses
 * High-priority emotions (angry, urgent) should override standard responses
 */
function shouldEmotionOverride(emotion, intensity) {
    const highPriorityEmotions = ['angry', 'urgent', 'fear'];
    return highPriorityEmotions.includes(emotion) || intensity > 0.7;
}

/**
 * Check if current context requires safety guard
 * Dangerous actions should never be allowed regardless of emotion
 */
function requiresSafetyGuard(message, context = {}) {
    const msg = message.toLowerCase();

    // Dangerous action patterns
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

module.exports = {
    EMOTION_CATEGORIES,
    detectEmotion,
    calculateIntensity,
    getEmotionResponseHints,
    shouldEmotionOverride,
    requiresSafetyGuard
};
