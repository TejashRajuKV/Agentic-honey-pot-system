import warnings
# Models were pickled with an older scikit-learn; they load and predict fine — silence the per-load version notice.
warnings.filterwarnings('ignore', message='.*Trying to unpickle estimator.*')
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from routes.threat_routes import threat_bp
import os

# ─────────────────────────────────────────
# Load environment variables FIRST
# ─────────────────────────────────────────
load_dotenv()

from config import PORT, DEBUG

# ─────────────────────────────────────────
# Create Flask app
# ─────────────────────────────────────────
app = Flask(__name__)

# ─────────────────────────────────────────
# Enable CORS (allow frontend origins)
# ─────────────────────────────────────────
# Keep browser access explicit. A missing FRONTEND_URL must never silently
# enable wildcard cross-origin access in a standalone deployment.
frontend_origin = os.getenv("FRONTEND_URL", "").strip()
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if frontend_origin and frontend_origin != "*":
    ALLOWED_ORIGINS.append(frontend_origin)
CORS(app, origins=ALLOWED_ORIGINS)

# ─────────────────────────────────────────
# Register Blueprints
# ─────────────────────────────────────────
from routes.health_routes    import health_bp
from routes.scam_routes      import scam_bp
from routes.behavior_routes  import behavior_bp
from routes.news_routes      import news_bp
from routes.loan_routes      import loan_bp
from routes.phishing_routes  import phishing_bp

app.register_blueprint(health_bp)
app.register_blueprint(scam_bp)
app.register_blueprint(behavior_bp)
app.register_blueprint(news_bp)
app.register_blueprint(loan_bp)
app.register_blueprint(phishing_bp)
app.register_blueprint(threat_bp, url_prefix="/api")


# ─────────────────────────────────────────
# Root endpoint — confirms server is alive
# ─────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "project":  "CyberRakshak",
        "status":   "running",
        "version":  "1.0.0",
        "endpoints": [
            "GET  /api/health",
            "GET  /api/version",
            "POST /api/scam",
            "POST /api/fakenews",
            "POST /api/behavior",
            "POST /api/phishing",
            "POST /api/loan",
            "GET  /api/loan/rules",
            "GET  /api/loan/check-app?name=<app_name>",
            "POST /api/threat"
        ]
    }), 200


# ─────────────────────────────────────────
# 404 Handler
# ─────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error":     "Endpoint not found",
        "status":    404,
        "hint":      "Visit GET / to see all available endpoints"
    }), 404


# ─────────────────────────────────────────
# 500 Handler
# ─────────────────────────────────────────
@app.errorhandler(500)
def server_error(e):
    # Keep exception details in server-side diagnostics, never in API responses.
    app.logger.error("Unhandled ML API exception: %s", type(e).__name__)
    return jsonify({
        "error": "Internal server error",
        "status": 500
    }), 500


# ─────────────────────────────────────────
# Load models at startup (for gunicorn/Render)
# ─────────────────────────────────────────
from utils.model_loader import load_models
load_models()

# ─────────────────────────────────────────
# Dev server entry point
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "=" * 45)
    print("   CYBERRAKSHAK — BACKEND STARTING")
    print("=" * 45)
    print(f"   Running on  http://localhost:{PORT}")
    print(f"   Health:     http://localhost:{PORT}/api/health")
    print("=" * 45 + "\n")

    # ML_HOST=127.0.0.1 when supervised by the Node gateway (internal-only);
    # falls back to all interfaces for standalone use.
    app.run(
        host=os.getenv("ML_HOST", "0.0.0.0"),
        port=PORT,
        debug=DEBUG,
        use_reloader=False   # a reloader forks a 2nd process the supervisor can't track
    )
