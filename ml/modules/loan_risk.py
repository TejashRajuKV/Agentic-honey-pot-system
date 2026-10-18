import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.response_formatter import format_response, format_error

# ─────────────────────────────────────────
# Scoring Rules — rebalanced weights
# ─────────────────────────────────────────
SCORING_RULES = {
    "too_many_permissions": {
        "score":  25,
        "reason": "App requests excessive permissions (contacts, SMS, camera)"
    },
    "no_rbi_registration": {
        "score":  35,
        "reason": "No RBI registration found for this lender"
    },
    "instant_approval": {
        "score":  15,
        "reason": "Claims instant approval with no documents"
    },
    "high_interest_rate": {
        "score":  20,
        "reason": "Interest rate exceeds 36% APR"
    },
    "not_on_playstore": {
        "score":  10,
        "reason": "App not found on official Google Play Store"
    },
    "requests_contacts": {
        "score":  15,
        "reason": "App requests access to your contacts list"
    },
    "requests_sms": {
        "score":  15,
        "reason": "App requests access to your SMS messages"
    },
    "requests_location": {
        "score":  10,
        "reason": "App requests continuous location access"
    },
    "no_physical_address": {
        "score":  10,
        "reason": "No physical office address provided"
    },
    "pressure_tactics": {
        "score":  20,
        "reason": "Uses pressure tactics like limited time offer"
    },
}

MAX_SCORE = sum(rule["score"] for rule in SCORING_RULES.values())
# MAX_SCORE = 175

# ─────────────────────────────────────────
# RBI Verified Safe Apps
# ─────────────────────────────────────────
RBI_SAFE_APPS = [
    {"name": "phonepe",          "display": "PhonePe",           "type": "UPI Payment"},
    {"name": "google pay",       "display": "Google Pay",         "type": "UPI Payment"},
    {"name": "gpay",             "display": "Google Pay",         "type": "UPI Payment"},
    {"name": "paytm",            "display": "Paytm",              "type": "Payment + Lending"},
    {"name": "bhim",             "display": "BHIM",               "type": "UPI Payment"},
    {"name": "amazon pay",       "display": "Amazon Pay",         "type": "UPI Payment"},
    {"name": "bajaj finserv",    "display": "Bajaj Finserv",      "type": "NBFC Lending"},
    {"name": "bajaj",            "display": "Bajaj Finserv",      "type": "NBFC Lending"},
    {"name": "hdfc bank",        "display": "HDFC Bank",          "type": "Scheduled Bank"},
    {"name": "hdfc",             "display": "HDFC Bank",          "type": "Scheduled Bank"},
    {"name": "sbi yono",         "display": "SBI YONO",           "type": "Scheduled Bank"},
    {"name": "sbi",              "display": "State Bank",         "type": "Scheduled Bank"},
    {"name": "icici bank",       "display": "ICICI Bank",         "type": "Scheduled Bank"},
    {"name": "icici",            "display": "ICICI Bank",         "type": "Scheduled Bank"},
    {"name": "axis bank",        "display": "Axis Bank",          "type": "Scheduled Bank"},
    {"name": "kotak mahindra",   "display": "Kotak Mahindra",     "type": "Scheduled Bank"},
    {"name": "kotak",            "display": "Kotak Mahindra",     "type": "Scheduled Bank"},
    {"name": "idfc first",       "display": "IDFC First Bank",    "type": "Scheduled Bank"},
    {"name": "tata capital",     "display": "Tata Capital",       "type": "NBFC Lending"},
    {"name": "mahindra finance", "display": "Mahindra Finance",   "type": "NBFC Lending"},
    {"name": "muthoot finance",  "display": "Muthoot Finance",    "type": "NBFC Lending"},
    {"name": "muthoot",          "display": "Muthoot Finance",    "type": "NBFC Lending"},
    {"name": "manappuram",       "display": "Manappuram Finance", "type": "NBFC Lending"},
    {"name": "early salary",     "display": "EarlySalary",        "type": "Digital Lending"},
    {"name": "kreditbee",        "display": "KreditBee",          "type": "Digital Lending"},
    {"name": "navi",             "display": "Navi",               "type": "Digital Lending"},
    {"name": "slice",            "display": "Slice",              "type": "Digital Lending"},
    {"name": "fi money",         "display": "Fi Money",           "type": "Digital Banking"},
    {"name": "jupiter",          "display": "Jupiter",            "type": "Digital Banking"},
    {"name": "moneyview",        "display": "MoneyView",          "type": "Digital Lending"},
    {"name": "lendingkart",      "display": "LendingKart",        "type": "SME Lending"},
]

# ─────────────────────────────────────────
# RBI Blacklisted / Dangerous Apps
# ─────────────────────────────────────────
RBI_DANGEROUS_APPS = [
    {"name": "cashnow",       "display": "CashNow",       "reason": "Reported predatory lending + data theft"},
    {"name": "rupeeclick",    "display": "RupeeClick",    "reason": "Illegal collection practices"},
    {"name": "loanfreed",     "display": "LoanFreed",     "reason": "No RBI registration found"},
    {"name": "okash",         "display": "OKash",         "reason": "Reported harassment of borrowers"},
    {"name": "creditfish",    "display": "CreditFish",    "reason": "Illegal interest rates"},
    {"name": "loanzone",      "display": "LoanZone",      "reason": "Data privacy violations"},
    {"name": "cashmantra",    "display": "CashMantra",    "reason": "Fake RBI registration claims"},
    {"name": "rupeeloan",     "display": "RupeeLoan",     "reason": "Reported blackmail tactics"},
    {"name": "snapit loan",   "display": "Snapit Loan",   "reason": "No registered office address"},
    {"name": "cashup",        "display": "CashUp",        "reason": "Illegal data access"},
    {"name": "quick rupee",   "display": "Quick Rupee",   "reason": "Reported contact harassment"},
    {"name": "loan mall",     "display": "Loan Mall",     "reason": "Illegal recovery agents"},
    {"name": "cash master",   "display": "Cash Master",   "reason": "Predatory interest rates"},
    {"name": "money master",  "display": "Money Master",  "reason": "Fake government affiliation claims"},
    {"name": "ez loan",       "display": "EZ Loan",       "reason": "No RBI registration"},
    {"name": "cashbean pro",  "display": "CashBean Pro",  "reason": "Reported privacy violations"},
    {"name": "money click",   "display": "Money Click",   "reason": "Illegal collection practices"},
    {"name": "instant rupee", "display": "Instant Rupee", "reason": "Predatory lending practices"},
    {"name": "loan pe",       "display": "LoanPe",        "reason": "Unregistered digital lender"},
    {"name": "cash advance",  "display": "Cash Advance",  "reason": "Reported data theft"},
]


# ─────────────────────────────────────────
# Check App Database
# ─────────────────────────────────────────
def check_app_database(app_name: str) -> dict:
    if not app_name or not app_name.strip():
        return {
            "app_name":      "Unknown",
            "db_status":     "NOT_CHECKED",
            "is_safe":       None,
            "message":       "No app name provided",
            "app_type":      None,
            "danger_reason": None
        }

    app_lower = app_name.lower().strip()

    for app in RBI_SAFE_APPS:
        if app["name"] in app_lower or app_lower in app["name"]:
            return {
                "app_name":      app["display"],
                "db_status":     "RBI_VERIFIED",
                "is_safe":       True,
                "message":       f"{app['display']} is RBI registered and verified safe",
                "app_type":      app["type"],
                "danger_reason": None
            }

    for app in RBI_DANGEROUS_APPS:
        if app["name"] in app_lower or app_lower in app["name"]:
            return {
                "app_name":      app["display"],
                "db_status":     "BLACKLISTED",
                "is_safe":       False,
                "message":       f"WARNING: {app['display']} is blacklisted",
                "app_type":      "Predatory Lender",
                "danger_reason": app["reason"]
            }

    return {
        "app_name":      app_name,
        "db_status":     "UNVERIFIED",
        "is_safe":       None,
        "message":       f"{app_name} not found. Verify at rbi.org.in",
        "app_type":      None,
        "danger_reason": None
    }


# ─────────────────────────────────────────
# Score Loan App
# ─────────────────────────────────────────
def score_loan(app_data: dict, models: dict = None) -> dict:
    try:
        total_score   = 0
        reasons       = []
        flagged_rules = []

        CRITICAL_RULES  = ["no_rbi_registration", "too_many_permissions"]
        HIGH_DATA_RULES = ["requests_contacts", "requests_sms", "requests_location"]

        for rule_key, rule_info in SCORING_RULES.items():
            if app_data.get(rule_key, False):
                total_score   += rule_info["score"]
                reasons.append(rule_info["reason"])
                flagged_rules.append(rule_key)

        # ── Normalize to 0-100 ──
        confidence = int((total_score / MAX_SCORE) * 100)
        confidence = min(100, confidence)

        # ── Critical rule boost ──
        critical_hit = any(
            app_data.get(r, False) for r in CRITICAL_RULES
        )
        data_hits = sum(
            1 for r in HIGH_DATA_RULES if app_data.get(r, False)
        )

        # no_rbi alone → minimum 50%
        if critical_hit and confidence < 50:
            confidence = 50

        # no_rbi + contacts + sms → minimum 55% = MEDIUM RISK
        if critical_hit and data_hits >= 2 and confidence < 55:
            confidence = 55

        # ── Reason string ──
        if reasons:
            if len(reasons) > 3:
                reason = (
                    " + ".join(reasons[:3])
                    + f" + {len(reasons) - 3} more risk factors"
                )
            else:
                reason = " + ".join(reasons)
        else:
            reason = "No risk factors detected — app appears legitimate"

        return format_response(
            module        = "loan_scorer",
            confidence    = confidence,
            reason        = reason,
            flagged_words = flagged_rules
        )

    except Exception as e:
        return format_error("loan_scorer", str(e))


# ─────────────────────────────────────────
# Get All Rules
# ─────────────────────────────────────────
def get_rules() -> dict:
    return {
        key: {
            "score":  rule["score"],
            "reason": rule["reason"]
        }
        for key, rule in SCORING_RULES.items()
    }


    
