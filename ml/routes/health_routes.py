from flask import Blueprint, jsonify
from utils.model_loader import models_status

health_bp = Blueprint("health", __name__)


# ─────────────────────────────────────────
# GET /api/health
# ─────────────────────────────────────────
@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """
    System health check.
    Shows which models are loaded and ready.
    """
    status = models_status()

    all_loaded = all(status.values())

    return jsonify({
        "status":        "ok" if all_loaded else "partial",
        "models_loaded": all_loaded,
        "modules": {
            "scam_radar":       status.get("scam_radar",       False),
            "behavior_monitor": status.get("behavior_monitor", False),
            "fake_news":        status.get("fake_news",        False),
            "loan_scorer":      status.get("loan_scorer",      True)
        }
    }), 200


# ─────────────────────────────────────────
# GET /api/version
# ─────────────────────────────────────────
@health_bp.route("/api/version", methods=["GET"])
def version():
    """
    Project info endpoint.
    Show judges all modules and tech stack.
    """
    return jsonify({
        "project": "CyberRakshak",
        "version": "1.0.0",
        "team":    "Arctic Thunder",
        "event":   "AiFi Hackathon — REVA University",
        "modules": [
            "Scam Radar",
            "Behavior Monitor",
            "Fake News Checker",
            "Loan Risk Scanner"
        ],
        "tech_stack": {
            "frontend": "React + Anime.js",
            "backend":  "Flask + Python",
            "ml":       "Scikit-learn + NLTK"
        }
    }), 200
