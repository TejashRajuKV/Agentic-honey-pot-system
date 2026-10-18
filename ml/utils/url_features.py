import re
import urllib.parse

# ─────────────────────────────────────────
# URL Feature Extraction
# ─────────────────────────────────────────

# Known shorteners (phishing often uses these)
URL_SHORTENERS = [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "is.gd", "buff.ly", "adf.ly", "rebrand.ly"
]

# Suspicious TLDs common in phishing
SUSPICIOUS_TLDS = [
    ".tk", ".ml", ".ga", ".cf", ".xyz", ".top",
    ".ru", ".cn", ".pw", ".click", ".link", ".stream"
]

# Known brand words used in phishing domains
BRAND_IMPERSONATORS = [
    "paypal", "amazon", "google", "microsoft", "apple",
    "sbi", "hdfc", "icici", "axis", "rbi", "uidai",
    "netflix", "facebook", "whatsapp", "instagram",
    "flipkart", "paytm", "jio", "airtel", "bsnl"
]

# Suspicious words in URL path
SUSPICIOUS_WORDS = [
    "login", "verify", "secure", "update", "confirm",
    "account", "bank", "kyc", "otp", "claim", "reward",
    "urgent", "suspend", "blocked", "approve", "auth",
    "credential", "password", "free", "prize", "lucky"
]


def extract_url_features(url: str) -> dict:
    """
    Extract rule-based features from a URL.
    Used for both ML model AND rule-based scoring.
    """
    if not url:
        return {}

    url_lower = url.lower().strip()

    try:
        parsed = urllib.parse.urlparse(url_lower if "://" in url_lower else "http://" + url_lower)
        domain = parsed.netloc or ""
        path   = parsed.path   or ""
        full   = url_lower
    except Exception:
        domain = url_lower
        path   = ""
        full   = url_lower

    features = {
        # ── Length-based ──
        "url_length":        len(url),
        "domain_length":     len(domain),
        "path_length":       len(path),

        # ── Special characters ──
        "num_dots":          url_lower.count("."),
        "num_hyphens":       url_lower.count("-"),
        "num_at":            url_lower.count("@"),
        "num_slashes":       url_lower.count("/"),
        "num_equals":        url_lower.count("="),
        "num_question":      url_lower.count("?"),
        "num_underscores":   url_lower.count("_"),
        "num_percent":       url_lower.count("%"),
        "num_ampersand":     url_lower.count("&"),
        "num_digits_in_domain": sum(1 for c in domain if c.isdigit()),

        # ── Protocol ──
        "is_https":          int(url_lower.startswith("https")),
        "has_ip":            int(bool(re.search(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", domain))),

        # ── Suspicious patterns ──
        "is_shortened":      int(any(s in domain for s in URL_SHORTENERS)),
        "has_suspicious_tld": int(any(domain.endswith(tld) for tld in SUSPICIOUS_TLDS)),
        "has_brand_in_domain": int(any(brand in domain for brand in BRAND_IMPERSONATORS)),
        "has_suspicious_words": int(any(word in full for word in SUSPICIOUS_WORDS)),

        # ── Subdomains ──
        "num_subdomains":    len(domain.split(".")) - 2 if len(domain.split(".")) > 2 else 0,
        "domain_has_numbers": int(bool(re.search(r"\d", domain))),
    }

    return features


def get_feature_values(features: dict) -> list:
    """Convert feature dict to ordered list for ML model."""
    keys = [
        "url_length", "domain_length", "path_length",
        "num_dots", "num_hyphens", "num_at", "num_slashes",
        "num_equals", "num_question", "num_underscores",
        "num_percent", "num_ampersand", "num_digits_in_domain",
        "is_https", "has_ip",
        "is_shortened", "has_suspicious_tld", "has_brand_in_domain",
        "has_suspicious_words", "num_subdomains", "domain_has_numbers"
    ]
    return [features.get(k, 0) for k in keys]


def build_phishing_reason(features: dict) -> str:
    """Build human-readable reason string from features."""
    reasons = []

    if features.get("has_ip"):
        reasons.append("IP address used instead of domain name")
    if features.get("has_suspicious_tld"):
        reasons.append("Suspicious free domain extension (.tk/.ml/.xyz etc.)")
    if features.get("has_brand_in_domain"):
        reasons.append("Impersonates legitimate brand in domain name")
    if features.get("is_shortened"):
        reasons.append("URL is shortened to hide destination")
    if features.get("has_suspicious_words"):
        reasons.append("Suspicious keywords (login/verify/claim) in URL")
    if features.get("num_dots", 0) > 4:
        reasons.append("Too many dots — suspicious subdomain structure")
    if features.get("num_hyphens", 0) > 2:
        reasons.append("Excessive hyphens in domain name")
    if features.get("url_length", 0) > 100:
        reasons.append("Extremely long URL — may be obfuscating destination")

    if not reasons:
        return "No phishing patterns detected"

    return " + ".join(reasons)
