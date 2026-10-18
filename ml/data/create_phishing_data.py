import pandas as pd
import os

# ─────────────────────────────────────────
# Phishing URLs
# ─────────────────────────────────────────
phishing_urls = [
    "http://secure-sbi-kyc-update.xyz/login",
    "http://paypal-verify-account.tk/secure",
    "http://hdfc-bank-update.ml/kyc",
    "http://192.168.1.1/admin/login.php",
    "http://amazon-prize-claim.cf/reward",
    "http://free-recharge-jio.tk/claim",
    "http://rbi-kyc-suspend.xyz/update",
    "http://icicidirect-login-verify.ga/auth",
    "http://whatsapp-gold-download.ml/fake",
    "http://gov-pm-kisan-claim.tk/apply",
    "http://bit.ly/sbi-kyc-urgent",
    "http://tinyurl.com/upi-reward",
    "http://axisbank-secure-verify.cf/login",
    "http://freecoins-crypto.tk/claim",
    "http://netflix-free-premium.xyz/login",
    "http://my-airtel-recharge-free.cf/claim",
    "http://aadhaar-card-download.tk/update",
    "http://flipkart-cashback-offer.ml/claim",
    "http://court-notice-onlinecom.tk/verify",
    "http://cyber-police-notice.xyz/pay",
    "http://incometax-refund-claim.ga/apply",
    "http://pm-yojana-cash.tk/register",
    "http://upi-collect-request.cf/approve",
    "http://digital-arrest-bail.xyz/pay",
    "http://bank-account-blocked.tk/verify",
    "http://secure-login-paypal.com.phishing.ru/auth",
    "http://amazon.facebooks.hacker.ru/login",
    "http://google.account-verify.tk/auth",
    "http://apple-id-suspended.cf/unlock",
    "http://loan-instant-approval.ml/apply",
] * 40

legitimate_urls = [
    "https://www.sbi.co.in/",
    "https://www.hdfcbank.com/",
    "https://www.icicibank.com/",
    "https://www.google.com/",
    "https://www.youtube.com/",
    "https://www.amazon.in/",
    "https://www.flipkart.com/",
    "https://www.irctc.co.in/",
    "https://www.rbi.org.in/",
    "https://www.incometax.gov.in/",
    "https://uidai.gov.in/",
    "https://www.npci.org.in/",
    "https://www.bseindia.com/",
    "https://www.nseindia.com/",
    "https://www.bajajfinserv.in/",
    "https://www.paytm.com/",
    "https://www.phonepe.com/",
    "https://www.bharatpe.com/",
    "https://www.zerodha.com/",
    "https://www.groww.in/",
    "https://economictimes.indiatimes.com/",
    "https://www.ndtv.com/",
    "https://timesofindia.indiatimes.com/",
    "https://www.thehindu.com/",
    "https://github.com/",
    "https://www.linkedin.com/",
    "https://www.wikipedia.org/",
    "https://stackoverflow.com/",
    "https://www.coursera.org/",
    "https://www.udemy.com/",
] * 40

phishing_df   = pd.DataFrame({"url": phishing_urls,   "label": 1})  # 1 = Phishing
legitimate_df = pd.DataFrame({"url": legitimate_urls, "label": 0})  # 0 = Legitimate

df = pd.concat([phishing_df, legitimate_df], ignore_index=True)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

os.makedirs("data", exist_ok=True)
df.to_csv("data/phishing_urls.csv", index=False)

print(f"✓ phishing_urls.csv created → {len(phishing_df)} phishing + {len(legitimate_df)} legitimate = {len(df)} total")
print("Done!")
