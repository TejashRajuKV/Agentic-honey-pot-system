from flask import Blueprint, request, jsonify
from utils.model_loader import get_models
from utils.text_preprocessing import is_empty
from utils.response_formatter import format_error
from modules.fake_news_detector import check_news
from risk_engine.explainer import explain_news

news_bp = Blueprint("news", __name__)


# ─────────────────────────────────────────
# POST /api/fakenews
# ─────────────────────────────────────────
@news_bp.route("/api/fakenews", methods=["POST"])
def fakenews_detect():
    """
    Fake news detection endpoint.

    Request body:
    {
        "text": "Government gives free Rs 10000..."
    }

    Response:
    {
        "module":        "fake_news",
        "label":         "HIGH RISK",
        "confidence":    75,
        "risk_color":    "red",
        "reason":        "Fake news patterns detected...",
        "flagged_words": ["click link", "claim now"],
        "explanation":   {...}
    }
    """
    try:
        # ── Get request data ──
        data = request.get_json()

        if not data:
            return jsonify(
                format_error("fake_news", "No data provided")
            ), 400

        text = data.get("text", "")

        # ── Validate input ──
        if is_empty(text):
            return jsonify(
                format_error("fake_news", "Text cannot be empty")
            ), 400

        # ── Min length check ──
        if len(text.strip()) < 10:
            return jsonify(
                format_error("fake_news", "Text too short to analyze")
            ), 400

        # ── Get loaded models ──
        models = get_models()

        # ── Run prediction ──
        result = check_news(text, models)

        # ── Add explanation ──
        result["explanation"] = explain_news(
            text,
            result["confidence"]
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("fake_news", str(e))
        ), 500
