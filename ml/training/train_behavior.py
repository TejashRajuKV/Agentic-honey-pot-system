import pandas as pd
import numpy as np
import joblib
import os
import sys

# Add backend/ to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from config import DATA_DIR, MODEL_DIR

# ─────────────────────────────────────────
# Step 1: Generate Simulation Data
# ─────────────────────────────────────────
print("Generating behavior simulation data...")

np.random.seed(42)

# Normal behavior — 1000 rows
normal_data = {
    "hour":           np.random.randint(8, 22, 1000),       # Active 8am–10pm
    "amount":         np.random.uniform(10, 5000, 1000),    # Normal transaction
    "transactions":   np.random.randint(1, 10, 1000),       # Per day
    "new_device":     np.random.choice([0, 1], 1000, p=[0.95, 0.05]),  # Rarely new device
    "failed_logins":  np.random.randint(0, 2, 1000),        # Rarely fails
    "label": "normal"
}

# Anomalous behavior — 200 rows
anomaly_data = {
    "hour":           np.random.randint(0, 5, 200),         # Midnight activity
    "amount":         np.random.uniform(50000, 200000, 200),# Very high amount
    "transactions":   np.random.randint(20, 50, 200),       # Too many transactions
    "new_device":     np.random.choice([0, 1], 200, p=[0.1, 0.9]),  # New device
    "failed_logins":  np.random.randint(3, 10, 200),        # Multiple failures
    "label": "anomaly"
}

normal_df  = pd.DataFrame(normal_data)
anomaly_df = pd.DataFrame(anomaly_data)

df = pd.concat([normal_df, anomaly_df], ignore_index=True)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# ─────────────────────────────────────────
# Step 2: Save Dataset
# ─────────────────────────────────────────
os.makedirs(DATA_DIR, exist_ok=True)
csv_path = os.path.join(DATA_DIR, "behavior_simulation.csv")
df.to_csv(csv_path, index=False)
print(f"✓ behavior_simulation.csv saved → {csv_path}")

# ─────────────────────────────────────────
# Step 3: Prepare Features
# ─────────────────────────────────────────
print("Preparing features...")

features = ["hour", "amount", "transactions", "new_device", "failed_logins"]
X = df[features]

# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ─────────────────────────────────────────
# Step 4: Train Isolation Forest
# ─────────────────────────────────────────
print("Training Isolation Forest...")

model = IsolationForest(
    n_estimators=100,
    contamination=0.15,   # 15% expected anomalies
    random_state=42
)
model.fit(X_scaled)

# ─────────────────────────────────────────
# Step 5: Evaluate
# ─────────────────────────────────────────
predictions = model.predict(X_scaled)
# IsolationForest: -1 = anomaly, 1 = normal

anomalies_found = (predictions == -1).sum()
normal_found    = (predictions == 1).sum()

print(f"\nTotal samples : {len(df)}")
print(f"Anomalies found: {anomalies_found}")
print(f"Normal found   : {normal_found}")

# ─────────────────────────────────────────
# Step 6: Save Model + Scaler Together
# ─────────────────────────────────────────
os.makedirs(MODEL_DIR, exist_ok=True)

behavior_model_path = os.path.join(MODEL_DIR, "behavior_model.pkl")

# Save model and scaler together in one dict
joblib.dump(
    {"model": model, "scaler": scaler, "features": features},
    behavior_model_path
)

print(f"\n✓ behavior_model.pkl saved → {behavior_model_path}")
print("\nBehavior Monitor training complete!")
