from config import (
    HIGH_RISK_THRESHOLD,
    MEDIUM_RISK_THRESHOLD,
    RISK_HIGH,
    RISK_MEDIUM,
    RISK_SAFE,
    COLOR_HIGH,
    COLOR_MEDIUM,
    COLOR_SAFE
)


# ─────────────────────────────────────────
# Risk Label + Color from Confidence
# ─────────────────────────────────────────
def get_risk_label(confidence: int) -> str:
    """Convert confidence score to risk label."""
    if confidence >= HIGH_RISK_THRESHOLD:
        return RISK_HIGH
    elif confidence >= MEDIUM_RISK_THRESHOLD:
        return RISK_MEDIUM
    else:
        return RISK_SAFE


def get_risk_color(confidence: int) -> str:
    """Convert confidence score to color string for React."""
    if confidence >= HIGH_RISK_THRESHOLD:
        return COLOR_HIGH
    elif confidence >= MEDIUM_RISK_THRESHOLD:
        return COLOR_MEDIUM
    else:
        return COLOR_SAFE


# ─────────────────────────────────────────
# Standard JSON Response Builder
# ─────────────────────────────────────────
def format_response(
    module: str,
    confidence: int,
    reason: str,
    flagged_words: list = []
) -> dict:
    """
    Always returns the same JSON shape to React frontend.
    Every route must use this function.

    Shape:
    {
        "module":        "scam_radar",
        "label":         "HIGH RISK",
        "confidence":    87,
        "risk_color":    "red",
        "reason":        "OTP request + KYC fraud pattern",
        "flagged_words": ["otp", "kyc"]
    }
    """
    label = get_risk_label(confidence)
    color = get_risk_color(confidence)

    return {
        "module":        module,
        "label":         label,
        "confidence":    confidence,
        "risk_color":    color,
        "reason":        reason,
        "flagged_words": flagged_words
    }


# ─────────────────────────────────────────
# Error Response Builder
# ─────────────────────────────────────────
def format_error(module: str, error_message: str) -> dict:
    """
    Standard error response when something goes wrong.
    Used in routes try/except blocks.
    """
    return {
        "module":        module,
        "label":         "ERROR",
        "confidence":    0,
        "risk_color":    "grey",
        "reason":        error_message,
        "flagged_words": []
    }
