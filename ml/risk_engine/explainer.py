import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.feature_engineering import extract_features, build_reason
from utils.text_preprocessing import extract_flagged_words
from risk_engine.confidence import get_label, get_emoji

# ─────────────────────────────────────────
# Scam Explanation Templates
# ─────────────────────────────────────────
SCAM_TEMPLATES = {
    "high": [
        "This message contains multiple high-risk scam patterns common in India.",
        "Strong indicators of a UPI/KYC fraud attempt detected.",
        "This matches known digital arrest scam patterns reported to RBI.",
    ],
    "medium": [
        "This message contains some suspicious patterns. Be cautious.",
        "Moderate risk detected. Verify before taking any action.",
        "Some scam indicators found. Do not share OTP or personal details.",
    ],
    "safe": [
        "No significant scam patterns detected in this message.",
        "This message appears to be legitimate.",
        "Low risk detected. Always stay vigilant.",
    ]
}

FAKE_NEWS_TEMPLATES = {
    "high": [
        "This content matches known fake news and misinformation patterns.",
        "Multiple fake news indicators detected. Verify from official sources.",
        "This appears to be misinformation. Check RBI/government websites.",
    ],
    "medium": [
        "Some unverified claims detected. Cross-check before sharing.",
        "Moderate fake news risk. Verify from trusted news sources.",
        "Suspicious claims found. Do not forward without verification.",
    ],
    "safe": [
        "No fake news patterns detected in this content.",
        "Content appears to be factual and legitimate.",
        "Low misinformation risk detected.",
    ]
}

BEHAVIOR_TEMPLATES = {
    "high": [
        "Highly suspicious account activity detected. Secure your account immediately.",
        "Multiple anomalous behavior patterns found. Possible account compromise.",
        "Critical risk: Unusual activity suggests unauthorized access attempt.",
    ],
    "medium": [
        "Some unusual activity detected. Monitor your account closely.",
        "Moderate behavioral anomaly. Change password if activity is not yours.",
        "Suspicious activity detected. Review recent transactions.",
    ],
    "safe": [
        "Account activity appears normal.",
        "No suspicious behavior patterns detected.",
        "Behavior within normal parameters.",
    ]
}

LOAN_TEMPLATES = {
    "high": [
        "This loan app shows multiple red flags of a predatory lending scam.",
        "High risk loan app detected. Do NOT install or share personal details.",
        "This app matches known illegal loan app patterns reported in India.",
    ],
    "medium": [
        "Some concerning features found in this loan app. Proceed with caution.",
        "Moderate risk loan app. Verify RBI registration before proceeding.",
        "Suspicious loan app features detected. Check app reviews carefully.",
    ],
    "safe": [
        "This loan app appears to meet basic legitimacy criteria.",
        "No major red flags detected for this loan app.",
        "App appears relatively safe. Always verify RBI registration.",
    ]
}


# ─────────────────────────────────────────
# Get Template
# ─────────────────────────────────────────
def _get_template(templates: dict, confidence: int) -> str:
    """Pick appropriate template based on confidence."""
    import random
    if confidence >= 70:
        return random.choice(templates["high"])
    elif confidence >= 40:
        return random.choice(templates["medium"])
    else:
        return random.choice(templates["safe"])


# ─────────────────────────────────────────
# Main Explainer Functions
# ─────────────────────────────────────────
def explain_scam(text: str, confidence: int) -> dict:
    """
    Generate full explanation for scam detection result.
    """
    features      = extract_features(text)
    flagged_words = extract_flagged_words(text)
    reason        = build_reason(features)
    template      = _get_template(SCAM_TEMPLATES, confidence)
    label         = get_label(confidence)
    emoji         = get_emoji(confidence)

    return {
        "summary":       f"{emoji} {label}",
        "template":      template,
        "reason":        reason,
        "flagged_words": flagged_words,
        "tip":           _get_safety_tip("scam", confidence)
    }


def explain_news(text: str, confidence: int) -> dict:
    """
    Generate full explanation for fake news result.
    """
    features  = extract_features(text)
    reason    = build_reason(features)
    template  = _get_template(FAKE_NEWS_TEMPLATES, confidence)
    label     = get_label(confidence)
    emoji     = get_emoji(confidence)

    return {
        "summary":       f"{emoji} {label}",
        "template":      template,
        "reason":        reason,
        "flagged_words": [],
        "tip":           _get_safety_tip("news", confidence)
    }


def explain_behavior(data: dict, confidence: int) -> dict:
    """
    Generate full explanation for behavior anomaly result.
    """
    template = _get_template(BEHAVIOR_TEMPLATES, confidence)
    label    = get_label(confidence)
    emoji    = get_emoji(confidence)

    return {
        "summary":       f"{emoji} {label}",
        "template":      template,
        "reason":        "Behavioral analysis complete",
        "flagged_words": [],
        "tip":           _get_safety_tip("behavior", confidence)
    }


def explain_loan(app_data: dict, confidence: int) -> dict:
    """
    Generate full explanation for loan app risk result.
    """
    template = _get_template(LOAN_TEMPLATES, confidence)
    label    = get_label(confidence)
    emoji    = get_emoji(confidence)

    return {
        "summary":       f"{emoji} {label}",
        "template":      template,
        "reason":        "Loan app risk assessment complete",
        "flagged_words": [],
        "tip":           _get_safety_tip("loan", confidence)
    }


# ─────────────────────────────────────────
# Safety Tips
# ─────────────────────────────────────────
def _get_safety_tip(module: str, confidence: int) -> str:
    """Return actionable safety tip based on module and risk level."""

    tips = {
        "scam": {
            "high":   "Never share OTP, PIN, or password with anyone. Block and report this number immediately.",
            "medium": "Do not click any links. Verify by calling your bank directly on official number.",
            "safe":   "Stay vigilant. When in doubt, always verify before acting."
        },
        "news": {
            "high":   "Do NOT forward this message. Verify from official sources like PIB, RBI, or government websites.",
            "medium": "Cross-check this news from at least 2 trusted sources before sharing.",
            "safe":   "Content appears safe. Always verify news before sharing on WhatsApp groups."
        },
        "behavior": {
            "high":   "Change your password immediately. Enable 2FA. Contact your bank if you see unknown transactions.",
            "medium": "Review your recent account activity. Change password if activity is unfamiliar.",
            "safe":   "Account activity looks normal. Keep monitoring regularly."
        },
        "loan": {
            "high":   "Do NOT install this app or share Aadhaar/PAN details. Report to cybercrime.gov.in.",
            "medium": "Verify RBI registration at rbi.org.in before proceeding with this app.",
            "safe":   "Always verify loan app on RBI website before sharing personal documents."
        }
    }

    level = "high" if confidence >= 70 else "medium" if confidence >= 40 else "safe"
    return tips.get(module, {}).get(level, "Stay safe online.")
