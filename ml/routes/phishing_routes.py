from flask import Blueprint, request, jsonify
from utils.model_loader import get_models
from utils.response_formatter import format_error
from modules.phishing_detector import check_phishing

phishing_bp = Blueprint("phishing", __name__)


# ─────────────────────────────────────────
# POST /api/phishing
# ─────────────────────────────────────────
@phishing_bp.route("/api/phishing", methods=["POST"])
def phishing_detect():
    """
    Phishing URL detection endpoint.

    Request body:
    {
        "url": "http://secure-sbi-kyc-update.xyz/login"
    }

    Response:
    {
        "module":        "phishing_detector",
        "label":         "HIGH RISK",
        "confidence":    88,
        "risk_color":    "red",
        "reason":        "Suspicious TLD + Brand impersonation + No HTTPS",
        "flagged_words": ["Suspicious TLD", "Brand impersonation"]
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify(
                format_error("phishing_detector", "No data provided")
            ), 400

        url = data.get("url", "").strip()

        if not url:
            return jsonify(
                format_error("phishing_detector", "URL cannot be empty")
            ), 400

        # Min length sanity check
        if len(url) < 4:
            return jsonify(
                format_error("phishing_detector", "URL too short to analyze")
            ), 400

        # Get models
        models = get_models()

        # Run detection
        result = check_phishing(url, models)

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("phishing_detector", str(e))
        ), 500
