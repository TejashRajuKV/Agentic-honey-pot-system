import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from risk_engine.confidence import get_confidence_summary

# ─────────────────────────────────────────
# Module Weights
# Higher weight = more impact on overall score
# ─────────────────────────────────────────
MODULE_WEIGHTS = {
    "scam_radar":       0.35,   # 35% weight
    "behavior_monitor": 0.30,   # 30% weight
    "fake_news":        0.20,   # 20% weight
    "loan_scorer":      0.15,   # 15% weight
}


# ─────────────────────────────────────────
# Aggregate Scores
# ─────────────────────────────────────────
def aggregate_scores(scores: dict) -> dict:
    """
    Combine scores from all modules into
    one unified risk score for dashboard.

    Args:
        scores: dict with module results
        Example:
        {
            "scam_radar":       {"confidence": 87, ...},
            "behavior_monitor": {"confidence": 20, ...},
            "fake_news":        {"confidence": 75, ...},
            "loan_scorer":      {"confidence": 10, ...}
        }

    Returns:
        {
            "overall_confidence": 52,
            "overall_label":      "MEDIUM RISK",
            "overall_color":      "yellow",
            "overall_emoji":      "🟡",
            "module_summary":     {...},
            "highest_risk":       "scam_radar"
        }
    """
    if not scores:
        return _empty_summary()

    weighted_total = 0.0
    total_weight   = 0.0
    module_summary = {}
    highest_risk   = None
    highest_conf   = 0

    for module, result in scores.items():
        confidence = result.get("confidence", 0)
        weight     = MODULE_WEIGHTS.get(module, 0.25)

        # Weighted sum
        weighted_total += confidence * weight
        total_weight   += weight

        # Module summary
        summary = get_confidence_summary(confidence)
        module_summary[module] = {
            "confidence": confidence,
            "label":      summary["label"],
            "color":      summary["color"],
            "emoji":      summary["emoji"]
        }

        # Track highest risk module
        if confidence > highest_conf:
            highest_conf = confidence
            highest_risk = module

    # Overall confidence
    if total_weight > 0:
        overall_confidence = int(weighted_total / total_weight)
    else:
        overall_confidence = 0

    overall_confidence = max(0, min(100, overall_confidence))

    # Overall summary
    overall = get_confidence_summary(overall_confidence)

    return {
        "overall_confidence": overall_confidence,
        "overall_label":      overall["label"],
        "overall_color":      overall["color"],
        "overall_emoji":      overall["emoji"],
        "module_summary":     module_summary,
        "highest_risk":       highest_risk,
        "highest_risk_conf":  highest_conf
    }


# ─────────────────────────────────────────
# Single Module Summary
# ─────────────────────────────────────────
def summarize_single(module: str, confidence: int) -> dict:
    """
    Quick summary for a single module result.
    Used by individual routes.
    """
    summary = get_confidence_summary(confidence)

    return {
        "module":     module,
        "confidence": confidence,
        "label":      summary["label"],
        "color":      summary["color"],
        "emoji":      summary["emoji"]
    }


# ─────────────────────────────────────────
# Empty Summary (fallback)
# ─────────────────────────────────────────
def _empty_summary() -> dict:
    return {
        "overall_confidence": 0,
        "overall_label":      "SAFE",
        "overall_color":      "green",
        "overall_emoji":      "🟢",
        "module_summary":     {},
        "highest_risk":       None,
        "highest_risk_conf":  0
    }
