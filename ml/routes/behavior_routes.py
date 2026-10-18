from flask import Blueprint, request, jsonify
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

        # ── Validate field types ──
        try:
            behavior_data = {
                "hour":          int(data["hour"]),
                "amount":        float(data["amount"]),
                "transactions":  int(data["transactions"]),
                "new_device":    int(data["new_device"]),
                "failed_logins": int(data["failed_logins"])
            }
        except (ValueError, TypeError):
            return jsonify(
                format_error(
                    "behavior_monitor",
                    "All fields must be numbers"
                )
            ), 400

        # ── Validate ranges ──
        if not 0 <= behavior_data["hour"] <= 23:
            return jsonify(
                format_error("behavior_monitor", "Hour must be 0-23")
            ), 400

        if behavior_data["amount"] < 0:
            return jsonify(
                format_error("behavior_monitor", "Amount cannot be negative")
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
