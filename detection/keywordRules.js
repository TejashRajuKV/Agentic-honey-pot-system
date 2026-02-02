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
    ],

    // Emotional manipulation - Sympathy and social engineering
    emotionalManipulation: [
        /please.*help/i,
        /my.*job.*depends/i,
        /will.*lose.*job/i,
        /lose.*job.*if/i,
        /brother.*trust/i,
        /sister.*trust/i,
        /trust.*me/i,
        /i.*will.*help.*you/i,
        /helping.*you/i,
        /don'?t.*worry/i,
        /no.*need.*to.*worry/i,
        /relax.*i.*help/i,
    ],

    // Authority validation - References and legal threats
    authorityValidation: [
        /rbi.*circular/i,
        /government.*circular/i,
        /as.*per.*rbi/i,
        /section.*\d+/i,
        /under.*section/i,
        /legal.*action/i,
        /court.*case/i,
        /file.*complaint/i,
        /police.*complaint/i,
        /arrest.*warrant/i,
        /penalty.*fine/i,
        /summon/i,
        /notice.*issued/i,
    ],

    // Multilingual patterns - Hindi/Hinglish (basic detection)
    multilingual: [
        /\babhi\s+karo\b/i,          // do it now
        /\bjaldi\b/i,                // quickly
        /\bbaad\s+mein\s+problem\b/i, // later problem
        /\bkaro\s+na\b/i,            // please do
        /\bplease\s+karo\b/i,        // please do (hinglish)
        /\baap\s+ka\b/i,             // your (formal)
        /\bbhej\s+do\b/i,            // send it
        /\bverify\s+karo\b/i,        // verify (hinglish)
        /\bkyun\s+nahi\b/i,          // why not
    ],

    // Professional scam - Polite and formal language
    professionalScam: [
        /as.*discussed/i,
        /thank.*you.*for.*cooperation/i,
        /please.*complete.*verification/i,
        /kindly.*verify/i,
        /request.*you.*to/i,
        /we.*appreciate.*your/i,
        /good.*afternoon/i,
        /dear.*customer/i,
        /valued.*customer/i,
        /imps.*timeout/i,
        /error.*code.*\d+/i,
        /transaction.*failed.*code/i,
        /system.*error/i,
    ],

    // Brand impersonation - Fake company claims
    brandImpersonation: [
        /this.*is.*amazon/i,
        /amazon.*support/i,
        /flipkart.*support/i,
        /google.*pay/i,
        /paytm.*support/i,
        /phonepe.*support/i,
        /from.*amazon/i,
        /from.*flipkart/i,
        /official.*support/i,
        /customer.*care.*calling/i,
    ],

    // Multiple requests pattern - Cognitive overload
    multipleRequests: [
        /click.*and.*send/i,
        /send.*and.*confirm/i,
        /verify.*and.*click/i,
        /first.*then.*after/i,
        /step.*\d+.*step.*\d+/i,
    ],

    // Repetition indicators - For silent pressure detection
    repetitionIndicators: [
        /again/i,
        /once.*more/i,
        /told.*you/i,
        /asked.*you/i,
        /waiting.*for/i,
        /still.*waiting/i,
    ],

    // Aggression patterns - Rage phase detection
    aggression: [
        /wasting.*time/i,
        /time.*waste/i,
        /why.*not.*responding/i,
        /not.*listening/i,
        /you.*stupid/i,
        /idiot/i,
        /fool/i,
        /nonsense/i,
        /useless/i,
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

    // Emotional manipulation
    'please help me',
    'my job depends',
    'will lose my job',
    'trust me brother',
    'don\'t worry i will help',
    'no need to worry',

    // Authority claims
    'rbi circular',
    'government order',
    'legal action',
    'court case',
    'police complaint',
    'as per section',

    // Professional scam
    'as discussed',
    'thank you for cooperation',
    'please complete verification',
    'kindly verify',
    'imps timeout error',
    'error code',

    // Brand impersonation
    'amazon support',
    'flipkart support',
    'google pay support',
    'paytm customer care',
    'official support',

    // Small amount trap
    'send ₹1',
    'send ₹5',
    'just ₹1 for verification',
    'only ₹5',

    // Mixed tactics
    'account blocked don\'t worry',
    'problem but i will help',
    'urgent but don\'t panic',
];

module.exports = {
    SCAM_PATTERNS,
    SCAM_PHRASES
};
