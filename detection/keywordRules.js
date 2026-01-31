// detection/keywordRules.js

/**
 * Comprehensive keyword rules and patterns for scam detection
 * Optimized for rule-based detection without LLM
 */

const SCAM_PATTERNS = {
    // Banking/UPI fraud - Enhanced patterns
    banking: [
        /\bkyc\b/i,
        /\bupdate.*(account|kyc|details)/i,
        /\bverify.*(account|kyc|identity|upi)/i,
        /\bfreeze.*(account|card)/i,
        /\bblock.*(account|card|upi)/i,
        /\bsuspend.*(account|card)/i,
        /\bupi.*(pin|password|verify)/i,
        /\batm.*(pin|password)/i,
        /\bsend.*(otp|pin)/i,
        /\bconfirm.*(otp|pin)/i,
        /\benter.*(otp|pin|cvv)/i,
        /\bcvv/i,
        /\bcard.*(details|number|info)/i,
        /\bexpir(ed|y|ing|e)/i,
        /\brefund.*(process|pending)/i,
        /\bcashback/i,
        /\bbank.*details/i,
        /\baccount.*lock/i,
        /\bdeactivate.*account/i,
    ],

    // Phishing - Comprehensive prize/lottery scams
    phishing: [
        /click.*(link|here)/i,
        /verify.*(link|here)/i,
        /urgent.*action/i,
        /account.*suspend/i,
        /claim.*(prize|reward|money|gift)/i,
        /won.*(lottery|prize|car|iphone|money|cash|reward|gift|phone|laptop)/i,
        /you.*(won|win|selected)/i,
        /congratulations.*(won|winner|selected)/i,
        /selected.*(winner|lucky)/i,
        /lucky.*(winner|draw)/i,
        /winner.*(selected|announced)/i,
        /lottery.*(won|winner)/i,
        /prize.*(won|claim)/i,
    ],

    // Fake offers - Work from home, investments
    fakeOffers: [
        /limited.*(offer|time|slot)/i,
        /free.*(gift|car|iphone|laptop|phone|money|cash)/i,
        /earn.*(money|cash|income|lakh|thousand)/i,
        /work.*(home|online)/i,
        /instant.*(loan|money|cash)/i,
        /guaranteed.*(returns|profit|income)/i,
        /double.*(money|income)/i,
        /triple.*(money|income)/i,
        /win.*(car|iphone|prize|money|cash)/i,
        /part.*time.*(job|work|income)/i,
        /online.*(job|earning|income)/i,
        /investment.*(opportunity|scheme)/i,
    ],

    // Urgency tactics - Pressure to act now
    urgency: [
        /urgent/i,
        /immediate/i,
        /expires.*(today|soon|now)/i,
        /last.*(chance|day|hour)/i,
        /act.*(now|fast|quick)/i,
        /limited.*(time|period)/i,
        /hurry/i,
        /quickly/i,
        /right.*now/i,
        /within.*(hour|minute)/i,
    ],

    // Contact requests - Asking for personal info
    contactRequests: [
        /send.*(details|info|number|otp|pin)/i,
        /share.*(number|details|otp|pin)/i,
        /provide.*(number|details|info)/i,
        /call.*(back|me|now)/i,
        /whatsapp/i,
        /message.*back/i,
        /reply.*with/i,
    ]
};

const SCAM_PHRASES = [
    // Banking/KYC
    'verify your account',
    'update kyc',
    'kyc verification',
    'account will be blocked',
    'account blocked',
    'account suspended',
    'upi suspended',
    'send otp',
    'confirm otp',
    'enter otp',
    'share otp',

    // Prize/Lottery
    'won lottery',
    'won car',
    'won iphone',
    'won prize',
    'won money',
    'you have won',
    'you won',
    'congratulations won',
    'selected winner',
    'lucky winner',
    'claim prize',
    'claim reward',

    // Offers  
    'limited offer',
    'free gift',
    'free car',
    'free iphone',
    'work from home',
    'earn money',
    'guaranteed returns',
    'double your money',

    // Urgency
    'urgent action required',
    'urgent action',
    'expires today',
    'last chance',
    'act now',

    // Financial
    'cashback',
    'refund',
    'card details',
    'bank details',
    'cvv',
    'atm pin',
    'upi pin',
    'send money',
];

module.exports = {
    SCAM_PATTERNS,
    SCAM_PHRASES
};
