from flask import Blueprint, request, jsonify
import math
from utils.model_loader import get_models
from utils.response_formatter import format_error
from modules.behavior_monitor import check_behavior
from risk_engine.explainer import explain_behavior

behavior_bp = Blueprint("behavior", __name__)


# ─────────────────────────────────────────
# POST /api/behavior
# ─────────────────────────────────────────
@behavior_bp.route("/api/behavior", methods=["POST"])
def behavior_detect():
    """
    Behavior anomaly detection endpoint.

    Request body:
    {
        "hour":          2,
        "amount":        95000,
        "transactions":  25,
        "new_device":    1,
        "failed_logins": 5
    }

    Response:
    {
        "module":        "behavior_monitor",
        "label":         "HIGH RISK",
        "confidence":    80,
        "risk_color":    "red",
        "reason":        "Midnight activity + High amount...",
        "flagged_words": ["hour", "amount"],
        "explanation":   {...}
    }
    """
    try:
        # ── Get request data ──
        data = request.get_json()

        if not data:
            return jsonify(
                format_error("behavior_monitor", "No data provided")
            ), 400

        # ── Validate required fields ──
        required_fields = ["hour", "amount", "transactions",
                           "new_device", "failed_logins"]

        missing = [f for f in required_fields if f not in data]

        if missing:
            return jsonify(
                format_error(
                    "behavior_monitor",
                    f"Missing fields: {', '.join(missing)}"
                )
            ), 400

        # ── Validate field types without silently truncating values ──
        integer_fields = ("hour", "transactions", "new_device", "failed_logins")
        for field in integer_fields:
            value = data[field]
            if (isinstance(value, bool) or not isinstance(value, (int, float))
                    or not math.isfinite(value) or not value.is_integer() if isinstance(value, float) else False):
                return jsonify(format_error("behavior_monitor", f"Field '{field}' must be an integer")), 400
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                return jsonify(format_error("behavior_monitor", f"Field '{field}' must be an integer")), 400

        amount = data["amount"]
        if isinstance(amount, bool) or not isinstance(amount, (int, float)):
            return jsonify(format_error("behavior_monitor", "Field 'amount' must be a number")), 400

        behavior_data = {
            "hour": int(data["hour"]),
            "amount": float(amount),
            "transactions": int(data["transactions"]),
            "new_device": int(data["new_device"]),
            "failed_logins": int(data["failed_logins"])
        }

        # ── Validate ranges ──
        if not 0 <= behavior_data["hour"] <= 23:
            return jsonify(
                format_error("behavior_monitor", "Hour must be 0-23")
            ), 400

        if not math.isfinite(behavior_data["amount"]):
            return jsonify(
                format_error("behavior_monitor", "Amount must be a finite number")
            ), 400

        if behavior_data["amount"] < 0:
            return jsonify(
                format_error("behavior_monitor", "Amount cannot be negative")
            ), 400

        if behavior_data["transactions"] < 0 or behavior_data["failed_logins"] < 0:
            return jsonify(
                format_error("behavior_monitor", "Transaction and failed-login counts cannot be negative")
            ), 400

        if behavior_data["new_device"] not in (0, 1):
            return jsonify(
                format_error("behavior_monitor", "new_device must be 0 or 1")
            ), 400

        # ── Get loaded models ──
        models = get_models()

        # ── Run prediction ──
        result = check_behavior(behavior_data, models)

        # ── Add explanation ──
        result["explanation"] = explain_behavior(
            behavior_data,
            result["confidence"]
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("behavior_monitor", str(e))
        ), 500
