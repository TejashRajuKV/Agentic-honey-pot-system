from flask import Blueprint, request, jsonify
from utils.response_formatter import format_error
from modules.loan_risk import score_loan, get_rules, check_app_database
from risk_engine.explainer import explain_loan

loan_bp = Blueprint("loan", __name__)


# ─────────────────────────────────────────
# GET /api/loan/rules
# ─────────────────────────────────────────
@loan_bp.route("/api/loan/rules", methods=["GET"])
def loan_rules():
    try:
        rules = get_rules()
        return jsonify(rules), 200
    except Exception as e:
        return jsonify(format_error("loan_scorer", str(e))), 500


# ─────────────────────────────────────────
# GET /api/loan/check-app?name=cashnow
# ─────────────────────────────────────────
@loan_bp.route("/api/loan/check-app", methods=["GET"])
def check_app():
    """
    Quick app name database lookup.
    GET /api/loan/check-app?name=cashnow
    """
    try:
        app_name = request.args.get("name", "")
        result   = check_app_database(app_name)
        return jsonify(result), 200
    except Exception as e:
        return jsonify(format_error("loan_scorer", str(e))), 500


# ─────────────────────────────────────────
# POST /api/loan
# ─────────────────────────────────────────
@loan_bp.route("/api/loan", methods=["POST"])
def loan_score():
    try:
        data = request.get_json()

        if not data:
            return jsonify(
                format_error("loan_scorer", "No data provided")
            ), 400

        valid_keys = [
            "too_many_permissions",
            "no_rbi_registration",
            "instant_approval",
            "high_interest_rate",
            "not_on_playstore",
            "requests_contacts",
            "requests_sms",
            "requests_location",
            "no_physical_address",
            "pressure_tactics"
        ]

        has_valid = any(k in data for k in valid_keys)
        if not has_valid:
            return jsonify(
                format_error("loan_scorer", "No valid fields provided")
            ), 400

        # ── Normalize to bool ──
        app_data = {
            key: bool(data.get(key, False))
            for key in valid_keys
        }

        # ── Get app name if provided ──
        app_name = data.get("app_name", "").strip()
        app_db   = check_app_database(app_name)

        # ── Score loan ──
        result = score_loan(app_data)

        # ── Add explanation ──
        result["explanation"] = explain_loan(
            app_data,
            result["confidence"]
        )

        # ── Add database result ──
        result["app_database"] = app_db

        # ── If blacklisted → force HIGH RISK ──
        if app_db["db_status"] == "BLACKLISTED":
            result["confidence"] = max(result["confidence"], 90)
            result["label"]      = "HIGH RISK"
            result["risk_color"] = "red"
            result["reason"]     = f"RBI BLACKLISTED — {app_db['danger_reason']}"

        # ── If RBI verified → reduce risk ──
        elif app_db["db_status"] == "RBI_VERIFIED":
            result["confidence"] = min(result["confidence"], 15)
            result["label"]      = "SAFE"
            result["risk_color"] = "green"

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("loan_scorer", str(e))
        ), 500
