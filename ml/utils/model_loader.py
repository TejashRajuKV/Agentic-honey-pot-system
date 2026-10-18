import joblib
import os
from config import (
    BASE_DIR,
    MODEL_DIR,
    SCAM_MODEL_PATH,
    SCAM_VECTORIZER_PATH,
    FAKE_NEWS_MODEL_PATH,
    FAKE_NEWS_VECTORIZER_PATH,
    BEHAVIOR_MODEL_PATH,
    PHISHING_MODEL_PATH
)

# ─────────────────────────────────────────
# Global models dict
# ─────────────────────────────────────────
_models = {}


def load_models() -> dict:
    """
    Load all .pkl models ONCE at Flask startup.
    Returns dict with all models and vectorizers.
    Called in app.py before first request.
    """
    global _models
    print("\n" + "═"*40)
    print("   MODEL LOADER DEBUG")
    print("═"*40)
    print(f"   CWD:       {os.getcwd()}")
    print(f"   BASE_DIR:  {BASE_DIR}")
    print(f"   MODEL_DIR: {MODEL_DIR}")
    print(f"   SCAM_PATH: {SCAM_MODEL_PATH}")
    print(f"   SCAM_EXISTS: {os.path.exists(SCAM_MODEL_PATH)}")
    print("═"*40 + "\n")

    print("Loading models...")

    # ── Scam Radar ──
    if os.path.exists(SCAM_MODEL_PATH) and os.path.exists(SCAM_VECTORIZER_PATH):
        try:
            _models["scam_model"]  = joblib.load(SCAM_MODEL_PATH)
            _models["scam_vec"]    = joblib.load(SCAM_VECTORIZER_PATH)
            print("  ✓ Scam model loaded")
        except Exception as e:
            print(f"  ✗ ERROR loading Scam model: {e}")
            _models["scam_model"]  = None
            _models["scam_vec"]    = None
    else:
        _models["scam_model"]  = None
        _models["scam_vec"]    = None
        print("  ✗ Scam model NOT found")

    # ── Fake News ──
    if os.path.exists(FAKE_NEWS_MODEL_PATH) and os.path.exists(FAKE_NEWS_VECTORIZER_PATH):
        _models["news_model"]  = joblib.load(FAKE_NEWS_MODEL_PATH)
        _models["news_vec"]    = joblib.load(FAKE_NEWS_VECTORIZER_PATH)
        print("  ✓ Fake news model loaded")
    else:
        _models["news_model"]  = None
        _models["news_vec"]    = None
        print("  ✗ Fake news model NOT found — run training/train_fakenews.py")

    # ── Behavior Monitor ──
    if os.path.exists(BEHAVIOR_MODEL_PATH):
        _models["behavior_model"] = joblib.load(BEHAVIOR_MODEL_PATH)
        print("  ✓ Behavior model loaded")
    else:
        _models["behavior_model"] = None
        print("  ✗ Behavior model NOT found — run training/train_behavior.py")

    # ── Phishing Detector ──
    if os.path.exists(PHISHING_MODEL_PATH):
        _models["phishing_model"] = joblib.load(PHISHING_MODEL_PATH)
        print("  ✓ Phishing model loaded")
    else:
        _models["phishing_model"] = None
        print("  ✗ Phishing model NOT found — run training/train_phishing.py")

    print("Model loading complete.\n")
    return _models


def get_models() -> dict:
    """
    Get already loaded models.
    Called by route handlers to access models.
    """
    return _models


def models_status() -> dict:
    """
    Returns which models are loaded.
    Used by GET /api/health endpoint.
    """
    return {
        "scam_radar":         _models.get("scam_model")      is not None,
        "fake_news":          _models.get("news_model")      is not None,
        "behavior_monitor":   _models.get("behavior_model")  is not None,
        "loan_scorer":        True,  # rule-based, no model needed
        "phishing_detector":  _models.get("phishing_model")  is not None
    }
