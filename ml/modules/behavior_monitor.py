import sys
import os
import numpy as np
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.response_formatter import format_response, format_error


# ─────────────────────────────────────────
# Risk Reasons based on behavior
# ─────────────────────────────────────────
def build_behavior_reason(data: dict) -> tuple:
    """
    Analyze transaction data and build reason string.
    Returns (reason, flagged_fields)
    """
    reasons = []
    flagged_fields = []

    hour = data.get("hour", 12)
    amount = data.get("amount", 0)
    transactions = data.get("transactions", 1)
    new_device = data.get("new_device", 0)
    failed_logins = data.get("failed_logins", 0)

    # Input safety
    if hour < 0 or hour > 23:
        hour = 12

    if amount < 0:
        amount = 0

    if transactions < 0:
        transactions = 0

    if failed_logins < 0:
        failed_logins = 0

    if hour >= 0 and hour <= 5:
        reasons.append("Unusual midnight activity detected")
        flagged_fields.append("hour")

    if amount >= 50000:
        reasons.append(f"Very high transaction amount Rs {amount:,.0f}")
        flagged_fields.append("amount")
    elif amount >= 20000:
        reasons.append(f"High transaction amount Rs {amount:,.0f}")
        flagged_fields.append("amount")

    if transactions >= 20:
        reasons.append(f"Too many transactions in one day ({transactions})")
        flagged_fields.append("transactions")
    elif transactions >= 10:
        reasons.append(f"High number of transactions ({transactions})")
        flagged_fields.append("transactions")

    if new_device == 1:
        reasons.append("Login from new/unknown device")
        flagged_fields.append("new_device")

    if failed_logins >= 3:
        reasons.append(f"Multiple failed login attempts ({failed_logins})")
        flagged_fields.append("failed_logins")

    if not reasons:
        return "Normal behavior detected", []

    return " + ".join(reasons), flagged_fields


# ─────────────────────────────────────────
# Check Behavior
# ─────────────────────────────────────────
def check_behavior(data: dict, models: dict) -> dict:
    """
    Main behavior anomaly detection function.
    Called by behavior_routes.py
    """

    try:

        hour          = data.get("hour",          12)
        amount        = data.get("amount",         0)
        transactions  = data.get("transactions",   1)
        new_device    = data.get("new_device",     0)
        failed_logins = data.get("failed_logins",  0)

        # ── Safety clamps ──
        hour         = max(0, min(23, int(hour)))
        amount       = max(0, min(10_000_000, float(amount)))
        transactions = max(0, int(transactions))
        failed_logins = max(0, int(failed_logins))

        # ── Rule-based risk scoring ──────────────────────────
        risk_score = 0

        if hour <= 5:
            risk_score += 25       # midnight/early hours

        if amount >= 100_000:
            risk_score += 35
        elif amount >= 50_000:
            risk_score += 28
        elif amount >= 20_000:
            risk_score += 18

        if transactions >= 30:
            risk_score += 25
        elif transactions >= 20:
            risk_score += 18
        elif transactions >= 10:
            risk_score += 10

        if new_device == 1:
            risk_score += 20

        if failed_logins >= 5:
            risk_score += 25
        elif failed_logins >= 3:
            risk_score += 18
        elif failed_logins >= 1:
            risk_score += 8

        # ── Count active risk factors ──
        risk_factors = sum([
            hour <= 5,
            amount >= 20_000,
            transactions >= 10,
            new_device == 1,
            failed_logins >= 3
        ])

        # Combination multiplier — multiple risk factors together = more suspicious
        if risk_factors >= 4:
            risk_score = min(100, int(risk_score * 1.25))
        elif risk_factors >= 3:
            risk_score = min(100, int(risk_score * 1.15))

        # Clamp to 0-95 (never 100% or 0% from rules alone)
        confidence = max(5, min(95, risk_score))

        # ── ML model as supplementary signal ─────────────────
        behavior_bundle = models.get("behavior_model")
        if behavior_bundle is not None:
            try:
                model   = behavior_bundle["model"]
                scaler  = behavior_bundle["scaler"]

                X        = np.array([[hour, amount, transactions, new_device, failed_logins]])
                X_scaled = scaler.transform(X)
                ml_pred  = model.predict(X_scaled)[0]   # -1 = anomaly, 1 = normal

                # ML says anomaly but rules say LOW — nudge up slightly
                if ml_pred == -1 and confidence < 40:
                    confidence = min(confidence + 15, 60)
                # ML says normal but rules say HIGH — reduce only slightly
                elif ml_pred == 1 and confidence > 70:
                    confidence = max(confidence - 5, 65)
            except Exception:
                pass  # ML supplementary only — ignore if fails

        # ── Build reason ──
        reason, flagged_fields = build_behavior_reason(data)

        return format_response(
            module        = "behavior_monitor",
            confidence    = confidence,
            reason        = reason,
            flagged_words = flagged_fields
        )

    except Exception as e:
        return format_error("behavior_monitor", str(e))
