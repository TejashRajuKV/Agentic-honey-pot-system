// agent/personaSystem.js

/**
 * Persona Switching System
 * Agent randomly chooses a persona to make behavior more realistic
 */

const PERSONAS = {
    confused_senior: {
        name: "Confused Senior Citizen",
        characteristics: {
            speed: "slow",
            techSavvy: "low",
            patience: "high",
            trustLevel: "high"
        },
        languagePatterns: {
            questions: [
                "I don't understand these technical words...",
                "Can you explain in simple language?",
                "My grandson usually helps me with phone, he's not here now",
                "This is too complicated for me"
            ],
            delays: [
                "Wait, my spectacles...",
                "Hold on, I need to find my reading glasses",
                "Let me call my son to help",
                "I'm not good with these apps"
            ],
            mistakes: [
                "I pressed wrong button",
                "Phone is too small, buttons hard to see",
                "I forget what you said, can you repeat?"
            ]
        }
    },

    busy_professional: {
        name: "Busy Office Worker",
        characteristics: {
            speed: "medium",
            techSavvy: "medium",
            patience: "low",
            trustLevel: "medium"
        },
        languagePatterns: {
            questions: [
                "I'm in a meeting, can this wait?",
                "Quick question - is this urgent?",
                "I have 2 minutes, make it fast"
            ],
            delays: [
                "Boss is calling, give me 5 mins",
                "In middle of presentation, will do after",
                "Phone on silent in meeting, just saw this"
            ],
            mistakes: [
                "Typing on laptop and phone simultaneously, sorry for errors",
                "Conference call going on, distracted"
            ]
        }
    },

    college_student: {
        name: "College Student",
        characteristics: {
            speed: "fast",
            techSavvy: "high",
            patience: "medium",
            trustLevel: "low"
        },
        languagePatterns: {
            questions: [
                "Is this legit? Sounds fishy",
                "How do I know you're not scamming?",
                "My friend got scammed like this",
                "Why do you need this info?"
            ],
            delays: [
                "In class rn, will check later",
                "Exam tomorrow, busy studying",
                "Internet slow in hostel"
            ],
            mistakes: [
                "sry typo",
                "autocorrect lol",
                "didnt mean to send that"
            ]
        }
    },

    non_tech_user: {
        name: "Non-Technical User",
        characteristics: {
            speed: "slow",
            techSavvy: "very_low",
            patience: "high",
            trustLevel: "high"
        },
        languagePatterns: {
            questions: [
                "What is UPI? Never used it",
                "I only know how to make calls and messages",
                "Can we do this offline? I don't trust online",
                "Is there phone number I can call?"
            ],
            delays: [
                "Apps confuse me, let me ask neighbor",
                "I prefer going to bank branch",
                "Can my son do this instead?"
            ],
            mistakes: [
                "I keep pressing back button by mistake",
                "App closed itself, what happened?",
                "Phone hanging, too slow"
            ]
        }
    },

    cautious_parent: {
        name: "Cautious Parent",
        characteristics: {
            speed: "medium",
            techSavvy: "medium",
            patience: "medium",
            trustLevel: "low"
        },
        languagePatterns: {
            questions: [
                "How do I verify this is genuine?",
                "Can you provide official documentation?",
                "I need to check with bank first",
                "My family warned me about online frauds"
            ],
            delays: [
                "Kids are home, little distracted",
                "Let me discuss with husband first",
                "This is family account, need to be careful"
            ],
            mistakes: [
                "Sorry wrong button pressed while handling baby",
                "Multitasking, kids screaming in background"
            ]
        }
    }
};

/**
 * Select random persona for a session
 * @returns {Object} - Persona configuration
 */
function selectPersona() {
    const personaKeys = Object.keys(PERSONAS);
    const randomKey = personaKeys[Math.floor(Math.random() * personaKeys.length)];

    return {
        type: randomKey,
        ...PERSONAS[randomKey]
    };
}

/**
 * Get persona-specific response modifier
 * @param {string} personaType - Type of persona
 * @param {string} responseType - Type of response (question/delay/mistake)
 * @returns {string} - Persona-specific phrase
 */
function getPersonaPhrase(personaType, responseType) {
    const persona = PERSONAS[personaType];

    if (!persona || !persona.languagePatterns[responseType]) {
        return null;
    }

    const phrases = persona.languagePatterns[responseType];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Apply persona characteristics to response
 * @param {string} response - Base response
 * @param {Object} persona - Persona configuration
 * @param {string} phase - Conversation phase
 * @returns {string} - Modified response
 */
function applyPersona(response, persona, phase) {
    if (!persona || !persona.type) {
        return response;
    }

    // Add persona-specific delays/questions occasionally
    if (Math.random() < 0.3 && phase === 'mid') {
        const delay = getPersonaPhrase(persona.type, 'delays');
        if (delay) {
            return delay;
        }
    }

    // Add persona-specific questions
    if (Math.random() < 0.25 && phase === 'early') {
        const question = getPersonaPhrase(persona.type, 'questions');
        if (question) {
            return question;
        }
    }

    // Add persona-specific mistakes
    if (Math.random() < 0.15) {
        const mistake = getPersonaPhrase(persona.type, 'mistakes');
        if (mistake) {
            return `${response} ${mistake}`;
        }
    }

    // Modify response based on tech-savviness
    if (persona.characteristics.techSavvy === 'low' ||
        persona.characteristics.techSavvy === 'very_low') {
        // Replace technical terms
        response = response
            .replace(/UPI/g, 'payment app')
            .replace(/OTP/g, 'verification code')
            .replace(/app/g, 'application');
    }

    return response;
}

module.exports = {
    selectPersona,
    getPersonaPhrase,
    applyPersona,
    PERSONAS
};
