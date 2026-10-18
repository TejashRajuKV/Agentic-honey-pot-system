import re
import string
import nltk
from nltk.corpus import stopwords

# ── NLTK Data ──
def init_nltk():
    try:
        # Only download if missing to avoid Windows PermissionError
        nltk.data.find("corpora/stopwords")
        nltk.data.find("tokenizers/punkt")
    except LookupError:
        try:
            nltk.download("stopwords", quiet=True)
            nltk.download("punkt", quiet=True)
        except Exception as e:
            print(f"Warning: NLTK download failed ({e}). Using existing data.")

init_nltk()
STOP_WORDS = set(stopwords.words("english"))

# ─────────────────────────────────────────
# Indian scam keywords to KEEP
# (never remove these as stopwords)
# ─────────────────────────────────────────
SCAM_KEYWORDS = [
    "kyc", "upi", "otp", "blocked", "suspended", "arrest",
    "freeze", "fraud", "urgent", "immediately", "verify",
    "account", "bank", "rbi", "police", "court", "penalty",
    "reward", "winner", "prize", "loan", "emi", "credit"
]


def clean_text(text: str) -> str:
    """
    Clean and normalize input text.
    Used by scam detector and fake news checker.
    """
    if not text or not isinstance(text, str):
        return ""

    # Lowercase
    text = text.lower()

    # Remove URLs
    text = re.sub(r"http\S+|www\S+", "", text)

    # Remove email addresses
    text = re.sub(r"\S+@\S+", "", text)

    # Remove phone numbers
    text = re.sub(r"\b\d{10}\b", "", text)

    # Remove punctuation (keep spaces)
    text = text.translate(str.maketrans("", "", string.punctuation))

    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Remove stopwords BUT keep scam keywords
    words = text.split()
    words = [
        w for w in words
        if w not in STOP_WORDS or w in SCAM_KEYWORDS
    ]

    return " ".join(words)


def extract_flagged_words(text: str) -> list:
    """
    Find scam keywords present in the input text.
    Used by explainer to highlight risky words.
    """
    if not text:
        return []

    text_lower = text.lower()
    found = [word for word in SCAM_KEYWORDS if word in text_lower]
    return found


def is_empty(text: str) -> bool:
    """
    Check if input text is empty or invalid.
    Used by routes before calling ML models.
    """
    return not text or not text.strip()
