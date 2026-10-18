from flask import Blueprint, request, jsonify
from utils.model_loader import get_models
from utils.text_preprocessing import is_empty
from utils.response_formatter import format_error
from modules.scam_detector import predict_scam
from risk_engine.explainer import explain_scam

scam_bp = Blueprint("scam", __name__)


# ─────────────────────────────────────────
# POST /api/scam
# ─────────────────────────────────────────
@scam_bp.route("/api/scam", methods=["POST"])
def scam_detect():
    """
    Scam message detection endpoint.

    Request body:
    {
        "message": "Your KYC will be suspended..."
    }

    Response:
    {
        "module":        "scam_radar",
        "label":         "HIGH RISK",
        "confidence":    87,
        "risk_color":    "red",
        "reason":        "OTP request + KYC fraud pattern",
        "flagged_words": ["kyc", "otp"],
        "explanation":   {...}
    }
    """
    try:
        # ── Get request data ──
        data    = request.get_json()

        if not data:
            return jsonify(
                format_error("scam_radar", "No data provided")
            ), 400

        message = data.get("message", "")

        # ── Validate input ──
        if is_empty(message):
            return jsonify(
                format_error("scam_radar", "Message cannot be empty")
            ), 400

        # ── Get loaded models ──
        models = get_models()

        # ── Run prediction ──
        result = predict_scam(message, models)

        # ── Add explanation ──
        result["explanation"] = explain_scam(
            message,
            result["confidence"]
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("scam_radar", str(e))
        ), 500
