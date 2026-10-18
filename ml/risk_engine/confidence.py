import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
# Confidence → Label
# ─────────────────────────────────────────
def get_label(confidence: int) -> str:
    """Convert confidence score to risk label."""
    if confidence >= HIGH_RISK_THRESHOLD:
        return RISK_HIGH
    elif confidence >= MEDIUM_RISK_THRESHOLD:
        return RISK_MEDIUM
    else:
        return RISK_SAFE


def get_color(confidence: int) -> str:
    """Convert confidence score to color for React."""
    if confidence >= HIGH_RISK_THRESHOLD:
        return COLOR_HIGH
    elif confidence >= MEDIUM_RISK_THRESHOLD:
        return COLOR_MEDIUM
    else:
        return COLOR_SAFE


def get_emoji(confidence: int) -> str:
    """Convert confidence score to emoji indicator."""
    if confidence >= HIGH_RISK_THRESHOLD:
        return "🔴"
    elif confidence >= MEDIUM_RISK_THRESHOLD:
        return "🟡"
    else:
        return "🟢"


# ─────────────────────────────────────────
# Probability → Confidence
# ─────────────────────────────────────────
def proba_to_confidence(probability: float) -> int:
    """
    Convert raw model probability (0.0 - 1.0)
    to confidence integer (0 - 100).
    """
    return int(round(probability * 100))


def clamp_confidence(value: int) -> int:
    """Ensure confidence stays between 0 and 100."""
    return max(0, min(100, value))


# ─────────────────────────────────────────
# Full Confidence Summary
# ─────────────────────────────────────────
def get_confidence_summary(confidence: int) -> dict:
    """
    Returns complete confidence info dict.
    Used by aggregator to build unified summary.
    """
    confidence = clamp_confidence(confidence)

    return {
        "confidence": confidence,
        "label":      get_label(confidence),
        "color":      get_color(confidence),
        "emoji":      get_emoji(confidence)
    }
