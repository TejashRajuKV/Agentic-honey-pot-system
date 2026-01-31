# How to Test the Honeypot System

## 🧪 Method 1: Interactive Chat (Recommended)

Chat with the honeypot agent in real-time:

```bash
node interactive-test.js
```

Then type your messages:
```
You: Your account will be blocked. Verify KYC now!
🤖 Agent: My account will be blocked? That's concerning. How can I prevent this?

⚠️  Scam Detected! Confidence: 85%
   Phase: early | Status: active

You: Click this link to verify
🤖 Agent: Should I click on some link? I'm a bit hesitant about links...
```

Type `exit` to quit.

---

## 🔬 Method 2: Automated Test Suite

Run all predefined test scenarios:

```bash
node test-honeypot.js
```

Tests 5 scenarios:
- Banking fraud (KYC scam)
- UPI fraud
- Phishing (lottery)
- Fake offers (work from home)
- Normal message (not a scam)

---

## 📡 Method 3: Direct API Testing

### Using cURL (Windows PowerShell)

```powershell
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "honeypot_secret_key_2026"
}

$body = @{
    sessionId = "test_123"
    message = "Your account will be blocked"
    platform = "test"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/messages" -Method Post -Headers $headers -Body $body
```

### Using cURL (Command Line)

```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: honeypot_secret_key_2026" \
  -d "{\"sessionId\":\"test_123\",\"message\":\"Your account will be blocked\",\"platform\":\"test\"}"
```

---

## 🎯 Example Scam Messages to Test

### Banking Fraud
```
Your account will be blocked due to pending KYC
Your UPI has been suspended. Send OTP to verify
Update your bank details immediately
```

### Phishing
```
Congratulations! You won ₹50,000. Click here to claim
Verify your account: http://fake-bank-verify.com
You've been selected for a prize!
```

### UPI Fraud
```
Send money to verify@paytm to unlock your account
Your UPI will expire. Verify at scammer@phonepe
```

### Fake Offers
```
Earn ₹10,000 daily working from home. Guaranteed returns!
Limited time offer! Double your money in 24 hours
Free iPhone! Call 9876543210 now
```

### Normal Messages (Should NOT detect as scam)
```
Hello, how are you?
What's the weather like today?
Thank you for your help
```

---

## 📊 Understanding the Response

```json
{
  "sessionId": "test_123",
  "reply": "Agent's response here",
  "isScam": true,              // Scam detected?
  "confidence": 0.85,           // 0.0 to 1.0
  "engagementPhase": "early",   // early/mid/late/final
  "status": "active",           // active/terminated
  "debug": {                    // Only in development mode
    "detectedCategories": ["banking", "urgency"],
    "extractedIntel": {
      "upiIds": ["verify@paytm"],
      "phoneNumbers": ["9876543210"],
      "urls": ["http://fake-site.com"],
      "scamPhrases": ["kyc", "account will be blocked"]
    }
  }
}
```

---

## 🔄 Testing Multi-Turn Conversations

Use the **interactive-test.js** tool and keep the same session:

```
Turn 1:
You: Your account will be blocked
Agent: My account will be blocked? That's concerning...

Turn 2:
You: Yes, verify your KYC immediately
Agent: Okay, I think I understand. What's the next step?

Turn 3:
You: Send OTP to verify@paytm
Agent: I'll get the OTP. Where should I send it?
```

The agent's responses evolve through phases:
- **Early** (turns 1-2): Shows concern, asks questions
- **Mid** (turns 3-5): Shows trust, requests details
- **Late** (turns 6-8): Ready to comply
- **Final** (turns 9+): Extracts final details, then terminates

---

## 🛠️ Advanced: View Session Details

Check extracted intelligence for a session:

```bash
curl -H "x-api-key: honeypot_secret_key_2026" \
  http://localhost:3000/api/v1/sessions/test_123
```

Shows:
- Total conversation turns
- All extracted intelligence
- Session status and phase
- Timestamps

---

## ✅ Testing Checklist

- [ ] Start server: `npm run dev`
- [ ] Run automated tests: `node test-honeypot.js`
- [ ] Try interactive chat: `node interactive-test.js`
- [ ] Test banking scam detection
- [ ] Test phishing detection
- [ ] Test normal message (no scam)
- [ ] Test multi-turn conversation
- [ ] Verify intelligence extraction (UPI/phone/URLs)
- [ ] Check session termination (after 10 turns)
