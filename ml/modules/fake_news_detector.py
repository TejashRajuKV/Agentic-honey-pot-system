import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.text_preprocessing import clean_text, extract_flagged_words
from utils.feature_engineering import extract_features, build_reason
from utils.response_formatter import format_response, format_error

# ─────────────────────────────────────────
# Fake News Keywords
# ─────────────────────────────────────────
FAKE_KEYWORDS = [
    "forward this", "share this", "government hiding",
    "doctors dont want", "secret", "shocking truth",
    "click link", "claim now", "free money",
    "whatsapp shutdown", "microchip", "5g",
    "bill gates", "illuminati", "conspiracy",
    "miracle cure", "guaranteed", "100 percent",
    "breaking exclusive", "leaked video",
    "free rs", "register using this link",
    "all citizens", "claim your", "apply now"
]

# ─────────────────────────────────────────
# WhatsApp Forward Patterns
# ─────────────────────────────────────────
FORWARD_PATTERNS = [
    "forwarded many times",
    "forward this to",
    "share this with",
    "send this to",
    "forward to 10",
    "forward to all",
    "must share",
    "please forward",
    "share immediately",
    "forward karo",
    "sabko bhejo",
    "viral hai",
    "sabse share karo",
    "abhi forward karo",
    "dont ignore",
    "very important forward",
    "please dont ignore",
    "share before deleted",
]


# ─────────────────────────────────────────
# Extract Fake Flags
# ─────────────────────────────────────────
def extract_fake_flags(text: str) -> list:
    """Find fake news pattern keywords in text."""
    if not text:
        return []
    text_lower = text.lower()
    return [kw for kw in FAKE_KEYWORDS if kw in text_lower]


# ─────────────────────────────────────────
# Detect WhatsApp Forward Pattern
# ─────────────────────────────────────────
def detect_forward_pattern(text: str) -> dict:
    """
    Detect if message has WhatsApp forward patterns.
    Returns forward info dict.
    """
    if not text:
        return {
            "is_forwarded":       False,
            "forward_indicators": [],
            "viral_risk":         "LOW"
        }

    text_lower = text.lower()
    found      = [p for p in FORWARD_PATTERNS if p in text_lower]

    return {
        "is_forwarded":       len(found) > 0,
        "forward_indicators": found,
        "viral_risk":         "HIGH"   if len(found) >= 2
                         else "MEDIUM" if len(found) == 1
                         else "LOW"
    }


# ─────────────────────────────────────────
# Build News Reason
# ─────────────────────────────────────────
def build_news_reason(features: dict, fake_flags: list, prediction: int) -> str:
    """Build reason string for fake news result."""
    reasons = []

    if fake_flags:
        reasons.append(f"Fake news patterns: {', '.join(fake_flags[:3])}")
    if features.get("has_urgent"):
        reasons.append("Urgency language detected")
    if features.get("has_reward"):
        reasons.append("Fake reward/prize claim detected")
    if features.get("has_link"):
        reasons.append("Suspicious link present")

    # If model says FAKE but no keyword reason found
    if not reasons and prediction == 1:
        return "ML model detected fake news linguistic patterns"

    if not reasons:
        return "No fake news patterns detected"

    return " + ".join(reasons)


# ─────────────────────────────────────────
# Check News
# ─────────────────────────────────────────
def check_news(text: str, models: dict) -> dict:
    """
    Main fake news detection function.
    Called by news_routes.py

    Args:
        text   : news headline or article text
        models : loaded models dict from model_loader

    Returns:
        Standard JSON response dict
    """
    try:
        # ── Get models ──
        model      = models.get("news_model")
        vectorizer = models.get("news_vec")

        if model is None or vectorizer is None:
            return format_error("fake_news", "Fake news model not loaded")

        # ── Preprocess ──
        cleaned = clean_text(text)

        # ── Vectorize ──
        X = vectorizer.transform([cleaned])

        # ── Predict ──
        prediction = model.predict(X)[0]   # 0 = REAL, 1 = FAKE

        # ── Confidence from decision function ──
        decision   = model.decision_function(X)[0]
        raw_conf   = abs(decision)
        confidence = int(min(100, max(0, raw_conf * 20)))

        # ── Extract explanation ──
        fake_flags   = extract_fake_flags(text)
        features     = extract_features(text)
        forward_info = detect_forward_pattern(text)

        # ── Build reason ──
        reason = build_news_reason(features, fake_flags, prediction)

        # ── Add forward pattern to reason ──
        if forward_info["is_forwarded"]:
            reason += " + Viral WhatsApp forward pattern detected"

        # ── Boost confidence if fake keywords found ──
        if prediction == 1 and len(fake_flags) > 0:
            confidence = max(confidence, 75)
        elif prediction == 0 and len(fake_flags) == 0:
            confidence = min(confidence, 30)

        # ── Boost if viral forward detected ──
        if forward_info["is_forwarded"] and prediction == 1:
            confidence = min(100, confidence + 10)

        # ── Override confidence based on prediction ──
        if prediction == 0:
            confidence = min(confidence, 35)   # REAL → SAFE range
        else:
            confidence = max(confidence, 70)   # FAKE → HIGH RISK range

        # ── Build result ──
        result = format_response(
            module        = "fake_news",
            confidence    = confidence,
            reason        = reason,
            flagged_words = fake_flags
        )

        # ── Add forward detection info ──
        result["forward_detection"] = forward_info

        return result

    except Exception as e:
        return format_error("fake_news", str(e))
