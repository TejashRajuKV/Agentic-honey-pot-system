from flask import Blueprint, request, jsonify
from utils.model_loader import get_models
from utils.text_preprocessing import is_empty
from utils.response_formatter import format_error
from modules.scam_detector import predict_scam
from modules.fake_news_detector import check_news
from modules.loan_risk import score_loan
from risk_engine.aggregator import aggregate_scores

threat_bp = Blueprint("threat", __name__)


# ─────────────────────────────────────────
# POST /api/threat
# ─────────────────────────────────────────
@threat_bp.route("/threat", methods=["POST"])
def threat_analyze():
    """
    Unified Threat Analyzer.
    Runs all relevant modules on input.

    Request body:
    {
        "message": "Your KYC will be suspended...",
        "url":     "http://suspicious-link.com",   (optional)
        "app":     "QuickLoan App"                  (optional)
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify(
                format_error("threat_analyzer", "No data provided")
            ), 400

        message = data.get("message", "")
        url     = data.get("url",     "")
        app     = data.get("app",     "")

        # ── Validate at least one field ──
        if is_empty(message) and is_empty(url) and is_empty(app):
            return jsonify(
                format_error("threat_analyzer", "Provide at least one input")
            ), 400

        models  = get_models()
        threats = []
        scores  = {}

        # ── Run Scam Radar on message ──
        if not is_empty(message):
            scam_result = predict_scam(message, models)
            scores["scam_radar"] = scam_result
            if scam_result["confidence"] >= 40:
                threats.append({
                    "type":       "Scam Message",
                    "icon":       "🎯",
                    "confidence": scam_result["confidence"],
                    "color":      scam_result["risk_color"],
                    "reason":     scam_result["reason"],
                    "keywords":   scam_result["flagged_words"]
                })

        # ── Run Fake News on message ──
        if not is_empty(message) and len(message.split()) > 5:
            news_result = check_news(message, models)
            scores["fake_news"] = news_result
            if news_result["confidence"] >= 40:
                threats.append({
                    "type":       "Fake News / Misinformation",
                    "icon":       "📰",
                    "confidence": news_result["confidence"],
                    "color":      news_result["risk_color"],
                    "reason":     news_result["reason"],
                    "keywords":   news_result["flagged_words"]
                })

        # ── Run URL check ──
        if not is_empty(url):
            url_threat = _check_url(url)
            scores["scam_radar"] = {"confidence": url_threat["confidence"]}
            if url_threat["confidence"] >= 40:
                threats.append(url_threat)

        # ── Run Loan App check ──
        if not is_empty(app):
            app_threat = _check_app_name(app, message)
            scores["loan_scorer"] = {"confidence": app_threat["confidence"]}
            if app_threat["confidence"] >= 40:
                threats.append(app_threat)

        # ── Aggregate overall score ──
        overall = aggregate_scores(scores)

        # ── Build response ──
        return jsonify({
            "overall_confidence": overall["overall_confidence"],
            "overall_label":      overall["overall_label"],
            "overall_color":      overall["overall_color"],
            "overall_emoji":      overall["overall_emoji"],
            "threat_count":       len(threats),
            "threats":            threats,
            "safe":               len(threats) == 0
        }), 200

    except Exception as e:
        return jsonify(
            format_error("threat_analyzer", str(e))
        ), 500


# ─────────────────────────────────────────
# URL Risk Check
# ─────────────────────────────────────────
def _check_url(url: str) -> dict:
    """Rule-based URL risk scoring."""
    score   = 0
    reasons = []

    url_lower = url.lower()

    suspicious_tlds = [".xyz", ".tk", ".ml", ".ga", ".cf", ".gq"]
    shorteners      = ["bit.ly", "tinyurl", "t.co", "goo.gl", "ow.ly", "short.ly"]
    phishing_words  = ["login", "verify", "update", "secure", "account",
                       "banking", "kyc", "otp", "confirm", "free", "prize"]

    if any(tld in url_lower for tld in suspicious_tlds):
        score += 40
        reasons.append("Suspicious domain extension detected")

    if any(s in url_lower for s in shorteners):
        score += 30
        reasons.append("URL shortener detected — hides real destination")

    if any(w in url_lower for w in phishing_words):
        score += 20
        reasons.append("Phishing keywords in URL")

    if not url_lower.startswith("https"):
        score += 15
        reasons.append("Not using secure HTTPS connection")

    if url_lower.count(".") > 3:
        score += 20
        reasons.append("Suspicious subdomain structure")

    confidence = min(100, score)

    return {
        "type":       "Suspicious URL",
        "icon":       "🔗",
        "confidence": confidence,
        "color":      "red" if confidence >= 70 else "yellow" if confidence >= 40 else "green",
        "reason":     " + ".join(reasons) if reasons else "URL appears safe",
        "keywords":   []
    }


# ─────────────────────────────────────────
# App Name Risk Check
# ─────────────────────────────────────────
def _check_app_name(app: str, message: str = "") -> dict:
    """Rule-based loan app name risk scoring."""
    score   = 0
    reasons = []

    app_lower     = app.lower()
    message_lower = message.lower()

    risky_words = ["instant", "quick", "fast", "easy", "guaranteed",
                   "no documents", "same day", "immediate", "urgent"]

    unregulated = ["cashe", "kredit", "cashbean", "loanfront",
                   "kissht", "prefr", "stashfin"]

    if any(w in app_lower for w in risky_words):
        score += 35
        reasons.append("App name contains high-risk lending keywords")

    if any(w in app_lower for w in unregulated):
        score += 50
        reasons.append("App matches known predatory lending app names")

    if "loan" in app_lower and "instant" in app_lower:
        score += 25
        reasons.append("Instant loan claim is a common scam pattern")

    if any(w in message_lower for w in ["no documents", "guaranteed", "instant approval"]):
        score += 30
        reasons.append("Message contains predatory loan offer language")

    confidence = min(100, score)

    return {
        "type":       "Suspicious Loan App",
        "icon":       "⚠️",
        "confidence": confidence,
        "color":      "red" if confidence >= 70 else "yellow" if confidence >= 40 else "green",
        "reason":     " + ".join(reasons) if reasons else "App name appears safe",
        "keywords":   []
    }