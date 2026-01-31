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
 * Generate contextual response based on phase and scam category
 * Following 5-level reply strategy
 */
function generateRuleBasedResponse(userMessage, phase, categories = []) {
    const msg = userMessage.toLowerCase();

    // Detect what information is present or requested
    const hasKYC = /kyc|verify|update|account/i.test(msg);
    const hasOTP = /otp|pin|code/i.test(msg);
    const hasUPI = /upi|paytm|phonepe|gpay|@/i.test(msg);
    const hasLottery = /won|lottery|prize|car|iphone|gift/i.test(msg);
    const hasMoney = /send|pay|money|rupees|amount|₹/i.test(msg);
    const hasLink = /link|click|website|url|http/i.test(msg);
    const hasNumber = /\d{10}|\d{4}/i.test(msg);
    const hasUrgency = /urgent|immediate|now|quick|fast|hurry/i.test(msg);

    // LEVEL 1: Opening Replies (Hook the scammer)
    if (phase === 'early') {

        if (hasKYC) {
            return pickRandom([
                "Oh no 😟 KYC issue? I'm worried now. What happened?",
                "Account verification? I didn't know there was a problem.",
                "This sounds serious... can you explain what I need to do?",
                "KYC? I'm not sure what that means exactly. Is my account okay?"
            ]);
        }

        if (hasLottery) {
            return pickRandom([
                "Really?? I won something? This is amazing! How did this happen?",
                "I can't believe it! Are you sure you have the right person?",
                "Wow! I never win anything 😊 What do I need to do?",
                "This is so exciting! Can you tell me more about the prize?"
            ]);
        }

        if (hasOTP || hasNumber) {
            return pickRandom([
                "OTP? I'm not sure what that is. Where do I find it?",
                "I see some numbers on my phone. Is that what you need?",
                "Which code are you talking about? I get many messages.",
                "I'm a bit confused about this. Can you explain more clearly?"
            ]);
        }

        if (hasUPI || hasMoney) {
            return pickRandom([
                "Payment? I'm not sure how to do that. Can you help me?",
                "UPI? I think I have that app but I rarely use it.",
                "Money transfer? This is new to me. What's the process?",
                "I'm worried about doing this wrong. What exactly should I do?"
            ]);
        }

        return pickRandom([
            "I just got your message. Can you explain this more clearly?",
            "I'm listening. What do you need me to do?",
            "This is important right? I want to understand properly.",
            "Sorry, I'm a bit confused. Can you start from the beginning?"
        ]);
    }

    // LEVEL 2: Clarification Replies (Extract intent)
    if (phase === 'mid') {

        // Information extraction questions
        if (hasUPI || hasMoney) {
            return pickRandom([
                // Extract UPI ID
                "Which UPI ID should I send to? Can you tell me again?",
                "Is it your personal UPI or company UPI?",
                "The message is not clear. What's the exact UPI address?",
                // Controlled mistake
                "I'm trying to enter it but app is asking for more details",
                "Should I send to the number you mentioned or different UPI?"
            ]);
        }

        if (hasLink) {
            return pickRandom([
                // Extract/confirm link
                "Can you send the link one more time? I didn't save it.",
                "The link is not opening. Is there another link?",
                "My phone says the link is suspicious. Is it safe?",
                // Human confusion
                "Do I just click it or do I need to copy somewhere?"
            ]);
        }

        if (hasOTP) {
            return pickRandom([
                // Delay tactic
                "OTP hasn't come yet. Should I wait or refresh?",
                "I'm getting many messages. Which one is the right OTP?",
                "The OTP expired. Can you send again?",
                // Controlled mistake
                "I entered the code but it says wrong. Let me try again?"
            ]);
        }

        // Clarification on process
        if (hasKYC) {
            return pickRandom([
                "What documents do I need for KYC? I have Aadhar card.",
                "Do I need to visit branch or can I do online?",
                "How long will this take? I have some work later.",
                "My friend also got this message. Is this for everyone?"
            ]);
        }

        return pickRandom([
            "I'm following along. What information do you need from me?",
            "Can you repeat the last step? I didn't understand properly.",
            "Is this official? How do I know this is real?",
            "Let me write this down so I don't make mistake. Go slow please."
        ]);
    }

    // LEVEL 3 & 4: Delay + Information Extraction
    if (phase === 'late') {

        // Delay & friction responses
        if (hasUrgency) {
            return pickRandom([
                "I'm trying but my internet is slow. Give me 2 minutes.",
                "App is loading... this phone is old 😅",
                "My wife is calling me. Can I do this in 5 minutes?",
                "Battery is 5%. Let me charge phone first then I'll do.",
                "I'm outside right now. Can I call you in 10 minutes instead?"
            ]);
        }

        // Naive compliance with controlled mistakes
        if (hasUPI || hasMoney) {
            return pickRandom([
                // LEVEL 5: Fake progress
                "Okay I opened UPI app. It's asking for PIN. What should I enter?",
                "I'm on the payment page. What amount did you say?",
                // Controlled mistake to confirm details
                "I tried sending but it failed. The UPI ID is correct right?",
                "App is showing error. Should I try different UPI app?",
                // Extract amount confirmation
                "Just to confirm - I need to send ₹1 or ₹10? I don't want to send wrong amount."
            ]);
        }

        if (hasOTP) {
            return pickRandom([
                // Fake technical issues
                "OTP is not coming. Network problem maybe?",
                "I got some code but it's only 4 digits. Is that correct?",
                // Controlled mistake
                "I entered 1234 but it says wrong. Send me the correct one?",
                "Should I wait for new OTP or use the old one?"
            ]);
        }

        if (hasLink) {
            return pickRandom([
                // Fake progress + friction
                "Link opened but page is blank. Is your website down?",
                "It's asking for login. What username should I use?",
                "My phone's browser crashed. Can you send again?",
                // Extract more info
                "Is this your official website or third party website?"
            ]);
        }

        return pickRandom([
            "I'm ready but little nervous. Walk me through each step please.",
            "One more question before I do - this is safe right?",
            "My hands are shaking because I'm worried. Tell me what to do.",
            "Okay okay I'll do it now. Just tell me exact steps."
        ]);
    }

    // LEVEL 5: Final - Compliance with questions
    if (phase === 'final') {
        return pickRandom([
            // Fake progress
            "Doing it now... app is opening...",
            "I clicked submit. Did you receive anything?",
            // Last-minute extraction
            "Before I finish, what's your name? I want to know who helped me.",
            "Is there a customer care number I can call if problem comes?",
            // Controlled delays
            "My phone hanged. Restarting... wait 1 minute.",
            "Transaction is processing... it's taking time...",
            // Safety mechanism - never actually complete
            "It says failed. Should I try again tomorrow?",
            "App crashed after I clicked. Did it go through on your side?"
        ]);
    }

    // Default fallback
    return "I understand. Can you tell me what to do next?";
}

/**
 * Add human imperfections to response
 * @param {string} response - Clean response
 * @returns {string} - Response with human imperfections
 */
function addHumanImperfections(response) {
    // Randomly add small imperfections (20% chance)
    if (Math.random() < 0.2) {
        const imperfections = [
            (r) => r.replace(/\./g, '..'), // Extra dots
            (r) => r.toLowerCase(), // All lowercase
            (r) => r + ' pls', // Add 'pls'
            (r) => r + ' 🙏', // Add emoji
            (r) => r.replace(/I'm/g, 'im'), // Grammar slip
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

module.exports = {
    generateRuleBasedResponse
};
