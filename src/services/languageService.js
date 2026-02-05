// src/services/languageService.js
const { franc } = require('franc');

/**
 * Language Detection Service
 * Detects and handles multi-language conversations (English, Hindi, Hinglish)
 */
class LanguageService {
    constructor() {
        // Hindi scam keywords
        this.hindiPatterns = {
            banking: ['खाता', 'बैंक', 'पैसा', 'रुपये', 'जमा', 'निकासी'],
            urgency: ['तुरंत', 'जल्दी', 'अभी', 'फटाफट'],
            authority: ['अधिकारी', 'पुलिस', 'सरकार', 'आरबीआई'],
            threat: ['ब्लॉक', 'बंद', 'केस', 'कार्रवाई'],
            request: ['भेजो', 'दो', 'बताओ', 'करो']
        };

        // Hinglish patterns (mixed)
        this.hinglishIndicators = [
            'aapka', 'apka', 'aap', 'hain', 'hai', 'karo', 'karo',
            'bhejo', 'batao', 'sir ji', 'madam ji', 'kyc karo',
            'account block', 'bank account', 'paisa bhejo'
        ];
    }

    /**
     * Detect language of text
     */
    detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return { language: 'unknown', confidence: 0 };
        }

        // Check for Hindi script
        const hasDevanagari = /[\u0900-\u097F]/.test(text);
        if (hasDevanagari) {
            // If has both English and Hindi, it's Hinglish
            const hasEnglish = /[a-zA-Z]/.test(text);
            if (hasEnglish) {
                return { language: 'hinglish', confidence: 0.9, script: 'mixed' };
            }
            return { language: 'hindi', confidence: 0.95, script: 'devanagari' };
        }

        // Check for Hinglish patterns (Hindi words in Roman script)
        const lowerText = text.toLowerCase();
        const hinglishCount = this.hinglishIndicators.filter(pattern =>
            lowerText.includes(pattern)
        ).length;

        if (hinglishCount >= 2) {
            return { language: 'hinglish', confidence: 0.8, script: 'roman' };
        }

        // Use franc for other language detection
        try {
            const detected = franc(text, { minLength: 10 });

            // Map franc codes to our language codes
            const langMap = {
                'eng': 'english',
                'hin': 'hindi',
                'und': 'unknown' // undefined
            };

            const language = langMap[detected] || 'english';
            const confidence = detected === 'und' ? 0.5 : 0.7;

            return { language, confidence, script: 'roman' };
        } catch (error) {
            // Default to English
            return { language: 'english', confidence: 0.6, script: 'roman' };
        }
    }

    /**
     * Extract Hindi scam patterns
     */
    extractHindiPatterns(text) {
        const detected = [];

        for (const [category, patterns] of Object.entries(this.hindiPatterns)) {
            for (const pattern of patterns) {
                if (text.includes(pattern)) {
                    detected.push({ category, pattern, text: pattern });
                }
            }
        }

        return detected;
    }

    /**
     * Handle Hinglish text (mixed Hindi-English)
     */
    handleHinglish(text) {
        const analysis = {
            isHinglish: false,
            confidence: 0,
            hinglishPhrases: [],
            translation: text, // Would need actual translation API
            scamIndicators: []
        };

        const lowerText = text.toLowerCase();

        // Detect Hinglish phrases
        const foundPhrases = this.hinglishIndicators.filter(phrase =>
            lowerText.includes(phrase)
        );

        if (foundPhrases.length > 0) {
            analysis.isHinglish = true;
            analysis.confidence = Math.min(foundPhrases.length / 5, 1);
            analysis.hinglishPhrases = foundPhrases;
        }

        // Check for common Hinglish scam patterns
        const scamPatterns = [
            { pattern: 'account block', severity: 'high', type: 'threat' },
            { pattern: 'kyc karo', severity: 'medium', type: 'action_request' },
            { pattern: 'paisa bhejo', severity: 'high', type: 'money_request' },
            { pattern: 'otp bhejo', severity: 'critical', type: 'credential_request' },
            { pattern: 'link par click', severity: 'high', type: 'phishing' },
            { pattern: 'jaldi karo', severity: 'medium', type: 'urgency' },
            { pattern: 'aapka account', severity: 'medium', type: 'impersonation' }
        ];

        for (const { pattern, severity, type } of scamPatterns) {
            if (lowerText.includes(pattern)) {
                analysis.scamIndicators.push({ pattern, severity, type });
            }
        }

        return analysis;
    }

    /**
     * Translate common Hindi/Hinglish scam phrases to English
     */
    translateToEnglish(text, sourceLang) {
        if (sourceLang === 'english') {
            return text;
        }

        // Simple translation dictionary for common scam phrases
        const translations = {
            // Banking
            'खाता': 'account',
            'बैंक': 'bank',
            'पैसा': 'money',
            'रुपये': 'rupees',

            // Actions
            'भेजो': 'send',
            'दो': 'give',
            'बताओ': 'tell',
            'करो': 'do',

            // Urgency
            'तुरंत': 'immediately',
            'जल्दी': 'quickly',
            'अभी': 'now',

            // Threats
            'ब्लॉक': 'block',
            'बंद': 'close',

            // Hinglish
            'aapka': 'your',
            'apka': 'your',
            'bhejo': 'send',
            'batao': 'tell',
            'karo': 'do'
        };

        let translated = text;
        for (const [hindi, english] of Object.entries(translations)) {
            const regex = new RegExp(hindi, 'gi');
            translated = translated.replace(regex, english);
        }

        return translated;
    }

    /**
     * Get language statistics for a session
     */
    async getLanguageStats(sessionId) {
        const ConversationTurn = require('../models/ConversationTurn');

        const turns = await ConversationTurn.find({ sessionId, role: 'user' });

        const stats = {
            totalMessages: turns.length,
            byLanguage: {
                english: 0,
                hindi: 0,
                hinglish: 0,
                other: 0
            },
            languageSequence: [],
            dominantLanguage: 'english',
            mixedLanguage: false
        };

        for (const turn of turns) {
            const detection = this.detectLanguage(turn.text);
            const lang = detection.language;

            stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
            stats.languageSequence.push({
                turn: turn.timestamp,
                language: lang,
                confidence: detection.confidence
            });
        }

        // Determine dominant language
        const langCounts = Object.entries(stats.byLanguage);
        const [dominant] = langCounts.sort((a, b) => b[1] - a[1])[0] || ['english', 0];
        stats.dominantLanguage = dominant;

        // Check if mixed language
        const uniqueLangs = langCounts.filter(([_, count]) => count > 0).length;
        stats.mixedLanguage = uniqueLangs > 1;

        return stats;
    }

    /**
     * Enhance scam detection with language-specific patterns
     */
    enhanceDetectionWithLanguage(text, baseDetection) {
        const detection = this.detectLanguage(text);
        const enhanced = { ...baseDetection };

        // Initialize scamProbability if missing (convert from confidence 0-1 to 0-100)
        if (enhanced.scamProbability === undefined && enhanced.confidence !== undefined) {
            enhanced.scamProbability = enhanced.confidence * 100;
        }

        // Add language context
        enhanced.language = detection.language;
        enhanced.languageConfidence = detection.confidence;

        // Check for Hindi-specific scam patterns
        if (detection.language === 'hindi' || detection.language === 'hinglish') {
            const hindiPatterns = this.extractHindiPatterns(text);
            if (hindiPatterns.length > 0) {
                enhanced.scamProbability += hindiPatterns.length * 5; // Boost for Hindi scam patterns
                enhanced.detectedPatterns = [...(enhanced.detectedPatterns || []), 'hindi_scam_language'];
            }

            if (detection.language === 'hinglish') {
                const hinglishAnalysis = this.handleHinglish(text);
                if (hinglishAnalysis.scamIndicators.length > 0) {
                    enhanced.scamProbability += hinglishAnalysis.scamIndicators.length * 10;
                    enhanced.detectedPatterns = [
                        ...(enhanced.detectedPatterns || []),
                        ...hinglishAnalysis.scamIndicators.map(i => `hinglish_${i.type}`)
                    ];
                }
            }
        }

        // Cap probability at 100
        enhanced.scamProbability = Math.min(enhanced.scamProbability || 0, 100);

        // Sync back to confidence (0-1)
        enhanced.confidence = enhanced.scamProbability / 100;

        return enhanced;
    }

    /**
     * Get common scam phrases by language
     */
    getCommonScamPhrases(language = 'english') {
        const phrases = {
            english: [
                'verify your account',
                'update your kyc',
                'send otp',
                'urgent action required',
                'account will be blocked',
                'click the link',
                'confirm payment',
                'refund process'
            ],
            hindi: [
                'खाता सत्यापित करें',
                'केवाईसी अपडेट करें',
                'ओटीपी भेजें',
                'तुरंत कार्रवाई आवश्यक',
                'खाता ब्लॉक हो जाएगा'
            ],
            hinglish: [
                'account verify karo',
                'kyc update karo',
                'otp bhejo',
                'jaldi karo urgent hai',
                'aapka account block ho jayega',
                'link par click karo',
                'paisa wapas milega'
            ]
        };

        return phrases[language] || phrases.english;
    }
}

module.exports = new LanguageService();
