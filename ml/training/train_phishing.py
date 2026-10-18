import pandas as pd
import numpy as np
import joblib
import os
import sys

# Add backend/ to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from config import DATA_DIR, MODEL_DIR
from utils.url_features import extract_url_features, get_feature_values

# ─────────────────────────────────────────
# Step 1: Generate / Load Dataset
# ─────────────────────────────────────────
print("Loading phishing URL dataset...")

csv_path = os.path.join(DATA_DIR, "phishing_urls.csv")

if not os.path.exists(csv_path) or os.path.getsize(csv_path) < 10:
    print("Dataset missing — generating synthetic data...")
    # Import and run the data creation script
    sys.path.append(DATA_DIR)
    exec(open(os.path.join(DATA_DIR, "create_phishing_data.py")).read())

df = pd.read_csv(csv_path)
print(f"  ✓ Loaded {len(df)} URLs ({df['label'].sum()} phishing, {(df['label']==0).sum()} legitimate)")

# ─────────────────────────────────────────
# Step 2: Extract Features
# ─────────────────────────────────────────
print("Extracting URL features...")

feature_list = []
for url in df["url"]:
    features = extract_url_features(url)
    feature_list.append(get_feature_values(features))

X = np.array(feature_list)
y = df["label"].values

# ─────────────────────────────────────────
# Step 3: Split
# ─────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ─────────────────────────────────────────
# Step 4: Train
# ─────────────────────────────────────────
print("Training Random Forest model...")

model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42
)
model.fit(X_train, y_train)

# ─────────────────────────────────────────
# Step 5: Evaluate
# ─────────────────────────────────────────
y_pred   = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nAccuracy: {accuracy * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Legitimate", "Phishing"]))

# ─────────────────────────────────────────
# Step 6: Save Model
# ─────────────────────────────────────────
os.makedirs(MODEL_DIR, exist_ok=True)

phishing_model_path = os.path.join(MODEL_DIR, "phishing_model.pkl")
joblib.dump(model, phishing_model_path)

print(f"\n✓ phishing_model.pkl saved → {phishing_model_path}")
print("\nPhishing URL Detector training complete!")
