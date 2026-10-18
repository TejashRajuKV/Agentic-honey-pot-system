// agent/replySafety.js
// Agent Safety Governor — the last check before a reply reaches a scammer.
//
// The honeypot must never (a) leak anything that looks like real personal data, (b) reveal that it is an
// AI / a honeypot / what its instructions are, or (c) follow instructions injected by the other party.
// The agent has no tools and cannot move money, so the risk here is information leakage and manipulation
// of the conversation — the OWASP "prompt injection / data exfiltration" class — not tool abuse.
//
// Checks are deterministic. When one fires, the reply is replaced with an in-persona stalling line
// and the intervention is recorded (audit log + session counter) so it is visible in the console.

const INJECTION_PATTERNS = [
    /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
    /disregard (your|the|all) (instructions|rules|prompt)/i,
    /(reveal|show|print|repeat|tell me) (me )?(your|the) (system )?(prompt|instructions|rules)/i,
    /you are (now )?(an? )?(ai|chatbot|language model|bot|dan)\b/i,
    /\b(act|pretend|behave) as (if you (are|were)|an?)\b.{0,40}\b(developer|admin|system|unrestricted)/i,
    /\b(jailbreak|developer mode|do anything now)\b/i,
    /are you (an? )?(ai|bot|robot|chatgpt|gemini|honeypot|machine)/i,
];

const LEAK_PATTERNS = [
    { check: 'reveals_ai_identity', re: /\b(i am|i'm|as) (an? )?(ai|artificial intelligence|language model|chatbot|bot|llm|assistant model)\b|\bhoney-?pot\b|\bgemini\b|\bgoogle ai\b/i, detail: 'Reply discloses that the sender is an AI / honeypot' },
    { check: 'leaks_instructions', re: /\b(system prompt|my instructions|i was (told|instructed|programmed)|persona (rules|prompt)|as per my (rules|guidelines))\b/i, detail: 'Reply refers to its own instructions' },
    { check: 'shares_card_number', re: /\b(?:\d[ -]?){13,19}\b/, detail: 'Reply contains a card-number-shaped digit string', luhn: true },
    { check: 'shares_aadhaar', re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/, detail: 'Reply contains an Aadhaar-shaped 12-digit number' },
    { check: 'shares_pan', re: /\b[A-Z]{5}\d{4}[A-Z]\b/, detail: 'Reply contains a PAN-shaped identifier' },
    { check: 'shares_credentials', re: /\b(my|the) (password|pin|cvv|otp|upi pin|mpin)\s*(is|:)\s*\S+/i, detail: 'Reply states a password / PIN / CVV / OTP value' },
    { check: 'claims_payment_done', re: /\b(i (have|'ve) (already )?(paid|transferred|sent (the )?(money|amount|₹|rs))|payment (is )?(done|complete|successful)|money (is )?(sent|transferred))\b/i, detail: 'Reply claims a payment has been made' },
];

const FALLBACKS = [
    "Sorry, I didn't understand that properly. Can you explain again slowly?",
    "One minute, someone is at the door. Please wait, I will look at this again.",
    "I am not very good with these things. Can you tell me again what exactly I need to do?",
    "The network here is bad, I could not follow. Please repeat.",
];

function luhnValid(digits) {
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = digits.charCodeAt(i) - 48;
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

/** Does the scammer's message try to manipulate the agent itself? */
function detectInjection(incoming = '') {
    return INJECTION_PATTERNS.filter((re) => re.test(incoming)).length > 0;
}

/**
 * @param {string} reply     the candidate reply
 * @param {string} incoming  the scammer message it answers
 * @returns {{reply:string, safe:boolean, interventions:Array<{check:string, detail:string}>, injectionAttempt:boolean}}
 */
function guardReply(reply, incoming = '') {
    const interventions = [];
    const injectionAttempt = detectInjection(incoming);
    let text = typeof reply === 'string' ? reply.trim() : '';

    if (!text) interventions.push({ check: 'empty_reply', detail: 'Agent produced no reply' });

    for (const rule of LEAK_PATTERNS) {
        const m = text.match(rule.re);
        if (!m) continue;
        if (rule.luhn && !luhnValid(m[0].replace(/\D/g, ''))) continue;   // digit strings that aren't card numbers are fine
        interventions.push({ check: rule.check, detail: rule.detail });
    }

    if (text.length > 600) {
        text = `${text.slice(0, 597)}...`;
        interventions.push({ check: 'overlong_reply', detail: 'Reply trimmed to 600 characters' });
    }

    // An injection attempt never gets an LLM-shaped answer: respond as a confused victim.
    if (injectionAttempt) {
        interventions.push({ check: 'prompt_injection_attempt', detail: 'Incoming message tried to manipulate the agent (override / reveal instructions / "are you a bot")' });
    }

    const mustReplace = interventions.some((i) => i.check !== 'overlong_reply') ;
    if (mustReplace) text = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];

    return { reply: text, safe: interventions.length === 0, interventions, injectionAttempt };
}

module.exports = { guardReply, detectInjection };
