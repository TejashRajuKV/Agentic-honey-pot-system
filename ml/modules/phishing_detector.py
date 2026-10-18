import sys
import os
import numpy as np
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.url_features import extract_url_features, get_feature_values, build_phishing_reason
from utils.response_formatter import format_response, format_error
from utils.url_intel import analyze_url


def check_phishing(url: str, models: dict) -> dict:
    """
    Main phishing URL detection function.
    Called by phishing_routes.py

    Args:
        url    : URL string to check
        models : loaded models dict from model_loader

    Returns:
        Standard JSON response dict
    """
    try:
        # ── Get model ──
        model = models.get("phishing_model")

        if model is None:
            # Fallback to rule-based only if model not loaded
            return _rule_based_check(url)

        # ── Extract features ──
        features     = extract_url_features(url)
        # Plain HTTP is not evidence of phishing (phishing sites routinely have valid certificates), so the
        # model always sees the HTTPS feature as "present". Structural evidence comes from utils/url_intel.py.
        feature_vals = np.array([get_feature_values({**features, "is_https": 1})])

        # ── Predict ──
        prediction   = model.predict(feature_vals)[0]         # 0 = legit, 1 = phishing
        probability  = model.predict_proba(feature_vals)[0]   # [legit_prob, phish_prob]
        confidence   = int(probability[1] * 100)              # phishing probability as %

        # ── Build reason ──
        reason        = build_phishing_reason(features)
        flagged_words = _get_flagged_parts(url, features)

        # ── Boost confidence with rules ──
        rule_flags = sum([
            features.get("has_ip", 0),
            features.get("has_suspicious_tld", 0),
            features.get("has_brand_in_domain", 0),
            features.get("is_shortened", 0),
        ])  # missing HTTPS is intentionally not a rule flag — see utils/url_intel.py

        if rule_flags >= 3:
            confidence = max(confidence, 80)
        elif rule_flags == 2:
            confidence = max(confidence, 55)
        elif rule_flags == 1:
            confidence = max(confidence, 30)

        # If model says legit but URL looks very suspicious
        if prediction == 0 and rule_flags >= 2:
            confidence = max(confidence, 50)

        return _with_intel(url, confidence, reason, flagged_words)

    except Exception as e:
        return format_error("phishing_detector", str(e))


def _explain(confidence: int, reason: str, official: str = None) -> dict:
    """Plain-language debrief + action, generated from the evidence (not a canned per-module string)."""
    if official:
        return {
            "template": f"This is an official {official.upper()} web address.",
            "tip": "Even on official domains, never share OTP/PIN with anyone who contacted you first.",
        }
    if confidence >= 65:
        return {
            "template": f"This link shows strong signs of phishing: {reason}.",
            "tip": "Do not open it or enter any details. If you already did, change your passwords now and report it at cybercrime.gov.in or call 1930.",
        }
    if confidence >= 30:
        return {
            "template": f"This link has some suspicious traits: {reason}.",
            "tip": "Do not click. Type the organisation's official address yourself or use its official app instead.",
        }
    return {
        "template": "No structural red flags were found in the address itself.",
        "tip": "A clean-looking link can still be dangerous. Never enter credentials on a site you reached from an unsolicited message.",
    }


def _with_intel(url: str, confidence: int, reason: str, flagged_words: list) -> dict:
    """Blend the model/rule score with offline URL intelligence and attach the evidence."""
    intel = analyze_url(url)
    if intel.get("official_brand") and not intel["signals"]:
        # The registered domain belongs to the brand itself — the brand-word heuristics don't apply
        result = format_response(module="phishing_detector", confidence=5, reason=f"Official {intel['official_brand'].upper()} domain ({intel['registered_domain']})", flagged_words=[])
        result["signals"] = []
        result["registered_domain"] = intel["registered_domain"]
        result["explanation"] = _explain(5, "", official=intel["official_brand"])
        return result
    strong = {"brand_impersonation", "punycode_domain", "non_ascii_domain", "credentials_in_url", "ip_host"}
    if any(s["signal"] in strong for s in intel["signals"]):
        confidence = max(confidence, min(95, 55 + intel["score"] // 2))
    else:
        confidence = max(confidence, intel["score"] // 2)
    top = [s["detail"] for s in sorted(intel["signals"], key=lambda s: -s["points"]) if s["points"] >= 10]
    if top:
        reason = "; ".join(top[:3])
    flagged = list(flagged_words) + [s["signal"].replace("_", " ") for s in intel["signals"] if s["points"] >= 10 and s["signal"].replace("_", " ") not in flagged_words]
    result = format_response(module="phishing_detector", confidence=min(100, confidence), reason=reason, flagged_words=flagged)
    result["signals"] = intel["signals"]
    result["registered_domain"] = intel["registered_domain"]
    result["explanation"] = _explain(result["confidence"], reason)
    return result


def _rule_based_check(url: str) -> dict:
    """
    Fallback: pure rule-based phishing detection
    when the model is not loaded.
    """
    try:
        features  = extract_url_features(url)
        reason    = build_phishing_reason(features)
        flagged   = _get_flagged_parts(url, features)

        rule_flags = sum([
            features.get("has_ip",               0),
            features.get("has_suspicious_tld",    0),
            features.get("has_brand_in_domain",   0),
            features.get("is_shortened",          0),
            features.get("has_suspicious_words",  0),
        ])

        confidence = min(100, rule_flags * 20)

        return _with_intel(url, confidence, reason + " (rule-based fallback)", flagged)
    except Exception as e:
        return format_error("phishing_detector", str(e))


def _get_flagged_parts(url: str, features: dict) -> list:
    """Extract the suspicious parts from the URL."""
    flagged = []
    url_lower = url.lower()

    if features.get("has_ip"):
        flagged.append("IP in domain")
    if features.get("has_suspicious_tld"):
        flagged.append("Suspicious TLD")
    if features.get("has_brand_in_domain"):
        flagged.append("Brand impersonation")
    if features.get("is_shortened"):
        flagged.append("Shortened URL")
    if features.get("has_suspicious_words"):
        flagged.append("Suspicious keywords")

    return flagged
