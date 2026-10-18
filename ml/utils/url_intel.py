"""
Offline URL intelligence.

Structural signals that need no network access and no external feed: homograph / punycode domains,
brand typosquatting, brand names hidden in sub-domains, credential tricks, raw-IP hosts and so on.
Each signal carries points and a human-readable explanation, so the score is always explainable.

Deliberately NOT a signal: the absence of HTTPS. Phishing sites routinely use valid certificates,
so plain HTTP is reported only as a very weak, informational hint.
"""
import re
import unicodedata
import urllib.parse

# brand -> domains the brand actually owns (registered domain, lowercase)
BRANDS = {
    "sbi":        ["sbi.co.in", "onlinesbi.sbi", "onlinesbi.com", "sbicard.com"],
    "hdfc":       ["hdfcbank.com", "hdfc.com", "hdfclife.com"],
    "icici":      ["icicibank.com", "icicilombard.com", "iciciprulife.com"],
    "axis":       ["axisbank.com"],
    "kotak":      ["kotak.com"],
    "paytm":      ["paytm.com", "paytmbank.com"],
    "phonepe":    ["phonepe.com"],
    "google":     ["google.com", "google.co.in", "goog.le"],
    "amazon":     ["amazon.in", "amazon.com"],
    "flipkart":   ["flipkart.com"],
    "microsoft":  ["microsoft.com", "live.com", "office.com"],
    "apple":      ["apple.com", "icloud.com"],
    "paypal":     ["paypal.com"],
    "facebook":   ["facebook.com", "fb.com"],
    "instagram":  ["instagram.com"],
    "whatsapp":   ["whatsapp.com", "whatsapp.net"],
    "netflix":    ["netflix.com"],
    "irctc":      ["irctc.co.in"],
    "uidai":      ["uidai.gov.in"],
    "npci":       ["npci.org.in"],
    "rbi":        ["rbi.org.in"],
    "incometax":  ["incometax.gov.in", "incometaxindia.gov.in"],
    "jio":        ["jio.com"],
    "airtel":     ["airtel.in", "airtel.com"],
}

SUSPICIOUS_TLDS = {"tk", "ml", "ga", "cf", "gq", "xyz", "top", "pw", "click", "link", "stream", "icu", "cyou", "buzz", "rest", "zip", "mov"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy"}
LURE_WORDS = ["login", "signin", "verify", "secure", "update", "confirm", "account", "kyc", "otp", "claim", "reward", "suspend", "blocked", "refund", "prize", "pan", "aadhaar"]
# second-level suffixes where the registered domain has three labels (e.g. sbi.co.in)
TWO_PART_SUFFIXES = {"co.in", "org.in", "gov.in", "net.in", "ac.in", "co.uk", "com.au", "com.br"}

CONFUSABLES = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "$": "s", "@": "a"})


def _split_host(host: str):
    labels = host.split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in TWO_PART_SUFFIXES:
        return labels[:-3], ".".join(labels[-3:])
    if len(labels) >= 2:
        return labels[:-2], ".".join(labels[-2:])
    return [], host


def _edit_distance(a: str, b: str, cap: int = 3) -> int:
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def analyze_url(url: str) -> dict:
    """Returns {"score": 0-100, "signals": [{"signal", "points", "detail"}], "registered_domain", "host"}."""
    signals = []

    def add(signal, points, detail):
        signals.append({"signal": signal, "points": points, "detail": detail})

    raw = (url or "").strip()
    try:
        parsed = urllib.parse.urlparse(raw if "://" in raw else "http://" + raw)
    except ValueError:
        return {"score": 0, "signals": [], "registered_domain": "", "host": ""}

    host = (parsed.hostname or "").lower()
    if not host:
        return {"score": 0, "signals": [], "registered_domain": "", "host": ""}
    sub_labels, registered = _split_host(host)
    sld = registered.split(".")[0]
    tld = registered.split(".")[-1]

    # ── Host shape ───────────────────────────────
    if re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host) or re.fullmatch(r"(0x[0-9a-f]+|\d{8,10})", host):
        add("ip_host", 35, "Site is addressed by a raw IP address instead of a domain name")
    if "@" in parsed.netloc:
        add("credentials_in_url", 35, "URL contains user@host — the text before @ is a decoy, the real site is after it")
    if len(sub_labels) >= 3:
        add("excessive_subdomains", 15, f"{len(sub_labels)} sub-domain levels — used to push the real domain out of view")
    if host.count("-") >= 3:
        add("hyphen_heavy_domain", 15, "Many hyphens in the domain, typical of throw-away phishing domains")
    if host in SHORTENERS or registered in SHORTENERS:
        add("url_shortener", 25, "Shortened link hides the real destination")

    # ── Homograph / punycode ─────────────────────
    if any(label.startswith("xn--") for label in host.split(".")):
        add("punycode_domain", 40, "Internationalised (xn--) domain — can render like a well-known brand with look-alike characters")
    elif any(ord(c) > 127 for c in host):
        scripts = {unicodedata.name(c, "?").split(" ")[0] for c in host if ord(c) > 127}
        add("non_ascii_domain", 40, f"Domain mixes in non-ASCII characters ({', '.join(sorted(scripts))}) that imitate Latin letters")

    if tld in SUSPICIOUS_TLDS:
        add("suspicious_tld", 20, f".{tld} is heavily abused by throw-away scam domains")

    # ── Brand impersonation ──────────────────────
    normalized = sld.translate(CONFUSABLES).replace("rn", "m").replace("vv", "w")
    flagged_brand = None
    is_official = any(registered in owned for owned in BRANDS.values())
    for brand in ([] if is_official else BRANDS):
        in_sub = any(brand in lab.translate(CONFUSABLES) for lab in sub_labels)
        in_sld = brand in sld or brand in normalized
        typo = (not in_sld) and len(sld) >= 4 and sld != brand and (normalized == brand or _edit_distance(normalized, brand) <= 1)
        # brand + extra words e.g. sbi-kyc-update.xyz
        if in_sub:
            flagged_brand = (brand, "subdomain")
        elif in_sld:
            flagged_brand = (brand, "domain")
        elif typo:
            flagged_brand = (brand, "typo")
        if flagged_brand:
            break
    if flagged_brand:
        brand, where = flagged_brand
        detail = {
            "subdomain": f"'{brand}' appears as a sub-domain, but the real domain is {registered}",
            "domain": f"'{brand}' is embedded in {registered}, which the brand does not own",
            "typo": f"{registered} looks like a misspelling of '{brand}'",
        }[where]
        add("brand_impersonation", 40 if where != "typo" else 45, detail)

    # ── Lure words in path/host ──────────────────
    haystack = (host + parsed.path + "?" + (parsed.query or "")).lower()
    lures = sorted({w for w in LURE_WORDS if w in haystack})
    if lures:
        add("lure_keywords", min(20, 6 * len(lures)), "Urgency/credential words in the address: " + ", ".join(lures[:5]))
    if len(raw) > 100 or raw.count("%") >= 4:
        add("long_or_encoded_url", 10, "Very long or heavily percent-encoded URL")

    # ── HTTPS: informational only ────────────────
    if parsed.scheme == "http":
        add("no_https", 3, "Plain HTTP (weak signal — phishing sites often have valid HTTPS too)")

    score = min(100, sum(s["points"] for s in signals))
    official = next((b for b, owned in BRANDS.items() if registered in owned), None)
    return {"score": score, "signals": signals, "registered_domain": registered, "host": host, "official_brand": official}
