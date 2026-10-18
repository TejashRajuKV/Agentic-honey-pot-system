import re

# ─────────────────────────────────────────
# Scam Pattern Rules
# ─────────────────────────────────────────
URGENT_KEYWORDS = [
    "urgent", "immediately", "asap", "right now",
    "within 24 hours", "last warning", "final notice"
]

OTP_PATTERNS = [
    "otp", "one time password", "verification code",
    "enter code", "share code"
]

RBI_PATTERNS = [
    "rbi", "reserve bank", "banking regulation",
    "rbi notice", "rbi alert"
]

ARREST_PATTERNS = [
    "digital arrest", "cyber arrest", "police notice",
    "court order", "legal action", "arrest warrant",
    "cybercrime", "cyber crime"
]

KYC_PATTERNS = [
    "kyc", "know your customer", "kyc blocked",
    "kyc suspended", "kyc expired", "update kyc"
]

REWARD_PATTERNS = [
    "you won", "winner", "prize", "reward",
    "claim now", "free gift", "lucky draw",
    "congratulations you"
]

LOAN_PATTERNS = [
    "instant loan", "no documents", "instant approval",
    "guaranteed loan", "pre approved", "easy loan"
]


# ─────────────────────────────────────────
# Feature Extraction
# ─────────────────────────────────────────
def extract_features(text: str) -> dict:
    """
    Extract rule-based features from text.
    Returns a dict of detected pattern categories.
    Used by explainer.py to build reason strings.
    """
    if not text:
        return {}

    text_lower = text.lower()

    features = {
        "has_urgent":  _match_any(text_lower, URGENT_KEYWORDS),
        "has_otp":     _match_any(text_lower, OTP_PATTERNS),
        "has_rbi":     _match_any(text_lower, RBI_PATTERNS),
        "has_arrest":  _match_any(text_lower, ARREST_PATTERNS),
        "has_kyc":     _match_any(text_lower, KYC_PATTERNS),
        "has_reward":  _match_any(text_lower, REWARD_PATTERNS),
        "has_loan":    _match_any(text_lower, LOAN_PATTERNS),
        "has_phone":   bool(re.search(r"\b\d{10}\b", text)),
        "has_link":    bool(re.search(r"http\S+|www\S+|bit\.ly", text_lower)),
        "is_allcaps":  _check_allcaps(text),
    }

    return features


def build_reason(features: dict) -> str:
    """
    Convert feature dict into human-readable reason string.
    Sent to React frontend as explanation.
    """
    reasons = []

    if features.get("has_urgent"):
        reasons.append("Urgent language detected")
    if features.get("has_otp"):
        reasons.append("OTP request detected")
    if features.get("has_rbi"):
        reasons.append("RBI impersonation pattern")
    if features.get("has_arrest"):
        reasons.append("Digital arrest threat detected")
    if features.get("has_kyc"):
        reasons.append("KYC fraud pattern detected")
    if features.get("has_reward"):
        reasons.append("Fake reward/prize scam pattern")
    if features.get("has_loan"):
        reasons.append("Suspicious loan offer detected")
    if features.get("has_phone"):
        reasons.append("Phone number present")
    if features.get("has_link"):
        reasons.append("Suspicious link detected")
    if features.get("is_allcaps"):
        reasons.append("Excessive use of capital letters")

    if not reasons:
        return "No suspicious patterns detected"

    return " + ".join(reasons)


# ─────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────
def _match_any(text: str, patterns: list) -> bool:
    return any(p in text for p in patterns)


def _check_allcaps(text: str) -> bool:
    words = text.split()
    if len(words) < 3:
        return False
    caps_count = sum(1 for w in words if w.isupper() and len(w) > 1)
    return caps_count / len(words) > 0.5
