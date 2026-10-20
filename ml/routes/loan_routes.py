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

        # Accept explicit booleans (and JSON numeric 0/1) only. Python's
        # bool("false") is True, which would otherwise turn client strings into
        # fabricated risk indicators and inflate the score.
        app_data = {}
        for key in valid_keys:
            value = data.get(key, False)
            if isinstance(value, bool):
                app_data[key] = value
            elif isinstance(value, int) and value in (0, 1):
                app_data[key] = bool(value)
            else:
                return jsonify(
                    format_error("loan_scorer", f"Field '{key}' must be a boolean")
                ), 400

        # ── Get app name if provided ──
        raw_app_name = data.get("app_name", "")
        if raw_app_name is None:
            raw_app_name = ""
        if not isinstance(raw_app_name, str):
            return jsonify(
                format_error("loan_scorer", "Field 'app_name' must be a string")
            ), 400
        app_name = raw_app_name.strip()
        app_db   = check_app_database(app_name)

        # ── Score loan ──
        result = score_loan(app_data)

        # ── Add database result ──
        result["app_database"] = app_db

        # ── If blacklisted → force HIGH RISK ──
        if app_db["db_status"] == "BLACKLISTED":
            result["confidence"] = max(result["confidence"], 90)
            result["label"]      = "HIGH RISK"
            result["risk_color"] = "red"
            result["reason"]     = f"Local risk-list match — {app_db['danger_reason']}"

        # A local reference-list match must never override observed risk factors.
        # In particular, don't cap a high-risk checklist result just because the
        # entered app name matches a known brand; brand-name spoofing is possible.
        # Build the explanation only after all overrides so its confidence matches
        # the final score returned to the frontend.
        result["explanation"] = explain_loan(
            app_data,
            result["confidence"]
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify(
            format_error("loan_scorer", str(e))
        ), 500
