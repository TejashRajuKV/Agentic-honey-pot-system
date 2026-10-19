from flask import Blueprint, jsonify
from utils.model_loader import models_status

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """Return explicit readiness for each ML module.

    The gateway uses this endpoint for diagnostics. A missing optional model must
    be visible as partial readiness instead of being silently reported as loaded.
    """
    status = models_status()
    core_models = ("scam_radar", "behavior_monitor", "fake_news", "phishing_detector")
    all_loaded = all(status.get(name, False) for name in core_models)

    return jsonify({
        "status": "ok" if all_loaded else "partial",
        "models_loaded": all_loaded,
        "modules": {
            "scam_radar": bool(status.get("scam_radar", False)),
            "behavior_monitor": bool(status.get("behavior_monitor", False)),
            "fake_news": bool(status.get("fake_news", False)),
            "phishing_detector": bool(status.get("phishing_detector", False)),
            # Loan scoring is rule-based and does not require a serialized model.
            "loan_scorer": bool(status.get("loan_scorer", True)),
        },
    }), 200


@health_bp.route("/api/version", methods=["GET"])
def version():
    """Project and module metadata."""
    return jsonify({
        "project": "CyberRakshak",
        "version": "1.0.0",
        "modules": [
            "Scam Radar",
            "Behavior Monitor",
            "Fake News Checker",
            "Phishing Detector",
            "Loan Risk Scanner",
        ],
        "tech_stack": {
            "frontend": "React + Vite",
            "backend": "Flask + Python",
            "ml": "Scikit-learn + NLTK",
        },
    }), 200
