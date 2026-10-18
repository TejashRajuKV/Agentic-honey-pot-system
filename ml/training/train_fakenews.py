import pandas as pd
import joblib
import os
import sys

# Add backend/ to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import PassiveAggressiveClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from config import DATA_DIR, MODEL_DIR
from utils.text_preprocessing import clean_text

# ─────────────────────────────────────────
# Step 1: Load Dataset
# ─────────────────────────────────────────
print("Loading dataset...")

true_path  = os.path.join(DATA_DIR, "True.csv")
fake_path  = os.path.join(DATA_DIR, "Fake.csv")

true_df = pd.read_csv(true_path)
fake_df = pd.read_csv(fake_path)

# Add labels
true_df["label"] = "REAL"
fake_df["label"] = "FAKE"

# Combine
df = pd.concat([true_df, fake_df], ignore_index=True)

# Use title + text combined
df["content"] = df["title"] + " " + df["text"]

# ─────────────────────────────────────────
# Step 2: Add Indian Fake News Examples
# ─────────────────────────────────────────
print("Adding Indian fake news examples...")

indian_examples = [
    {"content": "Government gives free Rs 10000 to all Aadhaar card holders click link to claim", "label": "FAKE"},
    {"content": "WhatsApp will be shut down next week unless you forward this message to 10 people", "label": "FAKE"},
    {"content": "New vaccine causes 5G activation in human body government hiding truth", "label": "FAKE"},
    {"content": "RBI announces free loan of Rs 500000 for all Indian citizens apply now", "label": "FAKE"},
    {"content": "PM Modi announces free electricity for all households below poverty line", "label": "FAKE"},
    {"content": "Supreme Court of India upholds new privacy law protecting citizen data", "label": "REAL"},
    {"content": "RBI raises repo rate by 25 basis points to control inflation", "label": "REAL"},
    {"content": "Indian economy grows at 7.2 percent in Q3 says finance ministry report", "label": "REAL"},
]

indian_df = pd.DataFrame(indian_examples)
df = pd.concat([df, indian_df], ignore_index=True)

# Shuffle
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# ─────────────────────────────────────────
# Step 3: Preprocess
# ─────────────────────────────────────────
print("Preprocessing text...")

df["cleaned"] = df["content"].apply(clean_text)
df["label_num"] = df["label"].map({"REAL": 0, "FAKE": 1})

# Drop empty rows
df = df.dropna(subset=["cleaned", "label_num"])

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

vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    stop_words="english"
)
X_train_vec = vectorizer.fit_transform(X_train)
X_test_vec  = vectorizer.transform(X_test)

# ─────────────────────────────────────────
# Step 6: Train
# ─────────────────────────────────────────
print("Training model...")

model = PassiveAggressiveClassifier(max_iter=1000)
model.fit(X_train_vec, y_train)

# ─────────────────────────────────────────
# Step 7: Evaluate
# ─────────────────────────────────────────
y_pred   = model.predict(X_test_vec)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nAccuracy: {accuracy * 100:.2f}%")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["REAL", "FAKE"]))

# ─────────────────────────────────────────
# Step 8: Save Models
# ─────────────────────────────────────────
os.makedirs(MODEL_DIR, exist_ok=True)

news_model_path = os.path.join(MODEL_DIR, "fake_news_model.pkl")
news_vec_path   = os.path.join(MODEL_DIR, "fake_news_vectorizer.pkl")

joblib.dump(model,      news_model_path)
joblib.dump(vectorizer, news_vec_path)

print(f"\n✓ fake_news_model.pkl      saved → {news_model_path}")
print(f"✓ fake_news_vectorizer.pkl saved → {news_vec_path}")
print("\nFake News Checker training complete!")

