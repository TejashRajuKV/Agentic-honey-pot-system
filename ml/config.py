import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# ─────────────────────────────────────────
# Server Config
# ─────────────────────────────────────────
PORT   = int(os.getenv("PORT", 5050))
DEBUG  = os.getenv("DEBUG", "True") == "True"

# ─────────────────────────────────────────
# Base Paths
# ─────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, os.getenv("MODEL_PATH", "models/"))
DATA_DIR  = os.path.join(BASE_DIR, os.getenv("DATA_PATH",  "data/"))

# ─────────────────────────────────────────
# Individual Model Paths
# ─────────────────────────────────────────
SCAM_MODEL_PATH          = os.path.join(MODEL_DIR, "scam_model.pkl")
SCAM_VECTORIZER_PATH     = os.path.join(MODEL_DIR, "scam_vectorizer.pkl")

FAKE_NEWS_MODEL_PATH     = os.path.join(MODEL_DIR, "fake_news_model.pkl")
FAKE_NEWS_VECTORIZER_PATH= os.path.join(MODEL_DIR, "fake_news_vectorizer.pkl")

BEHAVIOR_MODEL_PATH      = os.path.join(MODEL_DIR, "behavior_model.pkl")
PHISHING_MODEL_PATH      = os.path.join(MODEL_DIR, "phishing_model.pkl")

# ─────────────────────────────────────────
# Risk Thresholds
# ─────────────────────────────────────────
HIGH_RISK_THRESHOLD   = 70   # confidence >= 70 → HIGH
MEDIUM_RISK_THRESHOLD = 40   # confidence >= 40 → MEDIUM
                              # confidence <  40 → SAFE

# ─────────────────────────────────────────
# Risk Labels
# ─────────────────────────────────────────
RISK_HIGH   = "HIGH RISK"
RISK_MEDIUM = "MEDIUM RISK"
RISK_SAFE   = "SAFE"

# ─────────────────────────────────────────
# Risk Colors (sent to React frontend)
# ─────────────────────────────────────────
COLOR_HIGH   = "red"
COLOR_MEDIUM = "yellow"
COLOR_SAFE   = "green"