import pandas as pd
import joblib
import os
import sys

# Add backend/ to path so we can import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from config import DATA_DIR, MODEL_DIR
from utils.text_preprocessing import clean_text

# ─────────────────────────────────────────
# Step 1: Load Dataset
# ─────────────────────────────────────────
print("Loading dataset...")

csv_path = os.path.join(DATA_DIR, "spam.csv")
df = pd.read_csv(csv_path, encoding="latin-1")

# Keep only needed columns
df = df[["v1", "v2"]]
df.columns = ["label", "message"]

# ─────────────────────────────────────────
# Step 2: Add Indian Scam Examples
# ─────────────────────────────────────────
print("Adding Indian scam examples...")

indian_scams = [
    {"label": "spam", "message": "Your KYC will be blocked. Update immediately to avoid account suspension."},
    {"label": "spam", "message": "UPI collect request pending. Approve now or your account will be frozen."},
    {"label": "spam", "message": "Digital arrest notice issued. Pay fine immediately to avoid legal action."},
    {"label": "spam", "message": "Dear customer your SBI account is suspended. Send OTP to 9876543210."},
    {"label": "spam", "message": "Congratulations! You won Rs 50000 in lucky draw. Claim your prize now."},
    {"label": "spam", "message": "RBI notice: Your bank account will be closed. Verify KYC within 24 hours."},
    {"label": "spam", "message": "Urgent: Your Aadhaar linked account is blocked. Call immediately."},
    {"label": "spam", "message": "You have a pending UPI payment request of Rs 9999. Approve or decline now."},
    {"label": "spam", "message": "Your loan is approved. No documents needed. Click link to claim Rs 200000."},
    {"label": "spam", "message": "Income tax refund of Rs 15420 pending. Update bank details to receive."},
    {"label": "ham",  "message": "Your OTP for login is 452781. Valid for 10 minutes. Do not share."},
    {"label": "ham",  "message": "Your order has been shipped. Expected delivery by tomorrow."},
    {"label": "ham",  "message": "Your UPI transaction of Rs 500 to Rahul was successful."},
    {"label": "ham",  "message": "Meeting scheduled for tomorrow at 10am. Please confirm attendance."},
]

indian_df = pd.DataFrame(indian_scams)
df = pd.concat([df, indian_df], ignore_index=True)

# ─────────────────────────────────────────
# Step 3: Preprocess
# ─────────────────────────────────────────
print("Preprocessing text...")

df["cleaned"] = df["message"].apply(clean_text)
df["label_num"] = df["label"].map({"ham": 0, "spam": 1})

# ─────────────────────────────────────────
# Step 4: Split
# ─────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    df["cleaned"],
    df["label_num"],
    test_size=0.2,
    random_state=42
)

# ─────────────────────────────────────────
# Step 5: Vectorize
# ─────────────────────────────────────────
print("Vectorizing...")

vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec  = vectorizer.transform(X_test)

# ─────────────────────────────────────────
# Step 6: Train
# ─────────────────────────────────────────
print("Training model...")

model = LogisticRegression(max_iter=1000)
model.fit(X_train_vec, y_train)

# ─────────────────────────────────────────
# Step 7: Evaluate
# ─────────────────────────────────────────
y_pred   = model.predict(X_test_vec)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nAccuracy: {accuracy * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["ham", "spam"]))

# ─────────────────────────────────────────
# Step 8: Save Models
# ─────────────────────────────────────────
os.makedirs(MODEL_DIR, exist_ok=True)

scam_model_path = os.path.join(MODEL_DIR, "scam_model.pkl")
scam_vec_path   = os.path.join(MODEL_DIR, "scam_vectorizer.pkl")

joblib.dump(model,      scam_model_path)
joblib.dump(vectorizer, scam_vec_path)

print(f"\n✓ scam_model.pkl     saved → {scam_model_path}")
print(f"✓ scam_vectorizer.pkl saved → {scam_vec_path}")
print("\nScam Radar training complete!")
