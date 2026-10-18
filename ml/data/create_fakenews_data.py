import pandas as pd
import os

real_news = [
    "RBI raises repo rate by 25 basis points to control inflation in India",
    "Supreme Court upholds new data protection law for Indian citizens",
    "Indian economy grows at 7.2 percent in third quarter says finance ministry",
    "Parliament passes new education bill improving rural school infrastructure",
    "ISRO successfully launches satellite for weather monitoring mission",
    "Government announces new scheme for farmers doubling their income by 2025",
    "India signs trade agreement with UAE boosting bilateral commerce",
    "Election commission announces dates for upcoming state assembly elections",
    "New highway connecting Mumbai to Pune reduces travel time by 40 percent",
    "Digital payments in India cross 10 billion transactions in single month",
    "India wins gold medal in Commonwealth Games athletics competition",
    "New airport inaugurated in tier two city boosting regional connectivity",
    "Central bank releases new guidelines for digital lending platforms",
    "India achieves record wheat production this year says agriculture ministry",
    "Government launches new health insurance scheme for unorganised workers",
    "Stock market hits new all time high driven by foreign investor confidence",
    "India becomes third largest startup ecosystem in the world report says",
    "New metro line inaugurated connecting suburbs to city centre",
    "Government increases minimum support price for paddy and wheat crops",
    "India ranks higher in ease of doing business index this year",
] * 50

fake_news = [
    "Government gives free Rs 10000 to all Aadhaar card holders click link now",
    "WhatsApp will shut down next week unless you forward this to 10 people",
    "New vaccine causes 5G activation in human body scientists confirm",
    "RBI announces free loan of Rs 500000 for all Indian citizens apply now",
    "Drinking hot water with lemon cures cancer doctors do not want you to know",
    "Bill Gates microchip found inside COVID vaccine batch in Mumbai hospital",
    "Moon landing was fake NASA finally admits after 50 years of hiding truth",
    "Eating onions daily prevents coronavirus infection say top doctors",
    "Government to shut down all private banks and seize customer deposits",
    "Free electricity for all households PM Modi announces in secret meeting",
    "Alien spacecraft spotted over Delhi government orders media blackout",
    "New law allows police to arrest anyone without warrant starting next month",
    "WhatsApp sharing your private messages with government confirms source",
    "Petrol price to increase by Rs 50 per litre overnight government confirms",
    "India to become 51st state of USA Modi signs secret agreement",
    "Drinking cow urine daily boosts immunity by 10 times says AIIMS report",
    "Google paying Rs 25000 to anyone who shares this message in next 24 hours",
    "Onions placed in room absorbs all viruses and bacteria science proves",
    "ATMs to stop working from midnight government to replace all currency again",
    "Eating turmeric with milk cures all diseases including HIV doctors confirm",
] * 50

true_df = pd.DataFrame({"title": real_news, "text": real_news, "label": "REAL"})
fake_df = pd.DataFrame({"title": fake_news, "text": fake_news, "label": "FAKE"})

os.makedirs("data", exist_ok=True)
true_df.to_csv("data/True.csv", index=False)
fake_df.to_csv("data/Fake.csv", index=False)

print(f"✓ True.csv created → {len(true_df)} rows")
print(f"✓ Fake.csv created → {len(fake_df)} rows")
print("Done!")