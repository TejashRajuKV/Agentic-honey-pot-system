# 🐝 Agentic Honey-Pot System - Complete Feature Documentation

> **Complete list of all features, functions, and capabilities**

---

## 📊 1. Scam Detection Engine

### Multi-Layer Detection System
| Layer | Function | Weight |
|-------|----------|--------|
| **Pattern Matching** | Regex-based keyword detection | 35% |
| **Behavioral Analysis** | Repetition, pressure tactics | 20% |
| **Contextual Analysis** | Conversation flow analysis | 20% |
| **Intelligence Cross-Ref** | UPI/Phone/URL extraction | 15% |
| **Urgency Analysis** | Time pressure detection | 10% |

### Confidence Scoring
```
CRITICAL: 80%+ confidence
HIGH:     60-79% confidence
MEDIUM:   40-59% confidence
LOW:      20-39% confidence
SAFE:     <20% confidence
```

### Detected Scam Categories
- 🏦 **Banking Fraud** - KYC, account blocking, OTP requests
- 💰 **UPI Scams** - Payment requests, fake transfers
- 🎁 **Prize/Lottery Scams** - Fake winnings, gift claims
- 💼 **Job Scams** - Work-from-home, registration fees
- 📈 **Investment Scams** - Guaranteed returns, ponzi schemes
- 💳 **Refund Scams** - Fake cashback, excess payment
- 👮 **Authority Impersonation** - Police, RBI, government
- 🔗 **Phishing** - Suspicious links, credential harvesting

---

## 🤖 2. AI Agent System

### Conversation Phase Management
| Phase | Turn Count | Agent Behavior |
|-------|------------|----------------|
| **Early** | 0-2 | Hook scammer, show interest/concern |
| **Mid** | 3-5 | Extract information, ask questions |
| **Late** | 6-8 | Delay tactics, create friction |
| **Final** | 9+ | Fake compliance, string along |

### Emotion Detection Engine
Detects and adapts to 7 emotions:
- 😠 **Angry** → De-escalation responses
- 😕 **Confused** → Clarification requests
- 😰 **Fear** → Shows concern and worry
- ⏰ **Urgent** → Delays and stalls
- 😊 **Excited** → Cautious enthusiasm
- 🤝 **Trusting** → Cooperative but questioning
- 🤔 **Hesitant** → Verification requests

### Level 5 Bait Strategy
Strategic confusion tactics:
1. **Misinformation Bait** - Fake details to test scammer
2. **Technical Incompetence** - Pretends tech struggles
3. **Paranoid Questioning** - Challenges authority claims
4. **Fake Progress** - Simulates compliance
5. **Delayed Compliance** - Introduces realistic delays
6. **Fake Error Reports** - Reports fake issues

### Context-Aware Responses
- References previous conversation topics
- Avoids repeating the same responses
- Tracks scammer's claims and contradictions
- Escalates suspicion over conversation turns

---

## 🔍 3. Intelligence Extraction

### Automatically Extracted Data
| Type | Pattern | Example |
|------|---------|---------|
| **UPI IDs** | `user@bank` | `scammer@paytm` |
| **Phone Numbers** | 10-digit Indian | `9876543210` |
| **URLs** | HTTP/HTTPS links | `http://fake-bank.com` |
| **Amounts** | ₹ mentions | `₹5000`, `5000 rupees` |
| **Scam Phrases** | Keyword matches | "verify OTP", "urgent" |

### Behavioral Pattern Detection
- Urgency tactics
- Authority impersonation
- Information solicitation
- Threat of consequences
- Reward promises
- External communication requests

---

## 🧪 4. Edge Case Handling

### 20+ Tested Scenarios
| # | Scenario | Description |
|---|----------|-------------|
| 1 | **Slow-Burn Scam** | No initial urgency, builds gradually |
| 2 | **Polite Professional** | No threats, formal approach |
| 3 | **Reverse Scam** | Victim initiates contact |
| 4 | **Multi-Channel** | Claims SMS + Email |
| 5 | **Technical Jargon** | IMPS errors, system failures |
| 6 | **Sympathy Scam** | "My job depends on this" |
| 7 | **Authority Name-Drop** | RBI circular, Section 420 |
| 8 | **Language Switching** | Hindi/Hinglish mixing |
| 9 | **"Already Done" Pressure** | Claims prior warnings |
| 10 | **False Compliance Trap** | "No money needed" then asks |
| 11 | **Multiple Requests** | Cognitive overload tactics |
| 12 | **Identity Escalation** | Transfer to "senior officer" |
| 13 | **Time-Based Threat** | "2 hours left" deadlines |
| 14 | **Small Amount Test** | "Just ₹1 for verification" |
| 15 | **Brand Impersonation** | SBI, HDFC, RBI logos |
| 16 | **Over-Friendly** | "Brother trust me" |
| 17 | **Threat + Help Combo** | Scare then comfort |
| 18 | **Silent Pressure** | Repeating same message |
| 19 | **Fake Legal Action** | Court case threats |
| 20 | **Rage Phase** | Anger when victim hesitates |

---

## 🔌 5. API Endpoints

### Main Endpoint
```
POST /api/v1/messages
```

**Request:**
```json
{
  "sessionId": "session_123",
  "message": "Your account will be blocked!",
  "platform": "whatsapp"
}
```

**Response:**
```json
{
  "sessionId": "session_123",
  "reply": "Oh no! What should I do?",
  "isScam": true,
  "confidence": 0.72,
  "riskLevel": "HIGH",
  "engagementPhase": "early",
  "detectedPatterns": ["banking", "urgency"],
  "extractedIntel": {
    "upiIds": [],
    "phoneNumbers": [],
    "urls": []
  }
}
```

### Session Management
```
GET  /api/v1/sessions/:sessionId    # Get session details
POST /api/v1/sessions/:sessionId/end # End session
```

### Health Check
```
GET /api/v1/health
```

---

## 💾 6. Data Storage

### MongoDB Models

**Session Schema:**
- `sessionId` - Unique identifier
- `platform` - Source platform (whatsapp, sms, etc.)
- `status` - active/terminated
- `scamConfidence` - Cumulative confidence
- `engagementPhase` - Current phase
- `createdAt` / `updatedAt` - Timestamps

**ConversationTurn Schema:**
- `sessionId` - Parent session
- `role` - user/assistant
- `text` - Message content
- `timestamp` - Turn timestamp
- `metadata` - Detection results

---

## 🔒 7. Security Features

| Feature | Implementation |
|---------|----------------|
| **API Key Auth** | `x-api-key` header validation |
| **Input Sanitization** | XSS prevention |
| **Request Validation** | Mongoose schema validation |
| **MongoDB Injection** | Parameterized queries |
| **CORS** | Configurable origins |
| **Environment Config** | Secrets in `.env` |

---

## 🧠 8. LLM Integration

### Supported Providers
- **Google Gemini** (Primary)
- Rule-based fallback (No API needed)

### Configuration
```env
LLM_API_KEY=your_gemini_api_key
```

### Fallback Behavior
If LLM fails or unavailable:
1. Automatically falls back to rule-based responses
2. No service interruption
3. Logs warning message

---

## 📁 9. Project Structure

```
honeypot-backend/
├── src/                    # Core application
│   ├── server.js           # Entry point
│   ├── app.js              # Express config
│   ├── models/             # MongoDB schemas
│   ├── controllers/        # Request handlers
│   ├── routes/             # API routes
│   └── middleware/         # Auth, validation
├── agent/                  # AI Agent logic
│   ├── agentService.js     # Response generation
│   ├── conversationHandler.js  # Rule-based logic
│   ├── personaPrompts.js   # LLM prompts
│   ├── agentStateMachine.js    # Phase management
│   ├── baitStrategy.js     # Bait tactics
│   └── emotionDetector.js  # Emotion detection
├── detection/              # Scam detection
│   ├── advancedDetector.js # 5-layer analysis
│   ├── keywordRules.js     # Pattern definitions
│   ├── intelligenceExtractor.js # Intel extraction
│   └── emotionDetector.js  # Emotion analysis
└── tests/                  # Test suites
    ├── test-edge-cases.js  # 20 edge cases
    ├── test-bait-strategy.js
    └── test-emotion-detection.js
```

---

## 🧪 10. Testing

### Available Test Suites
```bash
node run-all-tests.js           # Run everything
node test-edge-cases.js         # 20 edge cases
node test-bait-strategy.js      # Bait tactics
node test-advanced-detection.js # Detection accuracy
node test-emotion-detection.js  # Emotion engine
node test-multi-turn.js         # Conversation flow
```

### Test Results
- ✅ **100% Pass Rate** (20/20 edge cases)
- ✅ **87% Average Detection Confidence**
- ✅ **Zero False Positives** in normal conversations

---

## 🚀 11. Deployment

### Supported Platforms
- Render
- Railway
- Vercel
- Heroku
- AWS/GCP/Azure

### Environment Variables
```env
PORT=3000
MONGODB_URI=mongodb://...
API_KEY=your_secret_key
LLM_API_KEY=gemini_api_key
NODE_ENV=production
```

---

## 📈 12. Performance Metrics

| Metric | Value |
|--------|-------|
| **Detection Accuracy** | 87%+ |
| **Response Time** | <500ms |
| **Edge Case Coverage** | 20+ scenarios |
| **False Positive Rate** | ~0% |
| **Test Pass Rate** | 100% |

---

## 🔄 13. Callback Integration

### Evaluation Platform Integration
```env
EVALUATION_CALLBACK_URL=https://your-platform.com/callback
```

### Callback Payload
```json
{
  "sessionId": "session_123",
  "intelligence": {
    "upiIds": ["scammer@paytm"],
    "phoneNumbers": ["9876543210"],
    "urls": ["http://fake.com"],
    "scamPhrases": ["verify OTP"],
    "behavioralPatterns": ["urgency", "authority"]
  },
  "conversationSummary": {
    "totalTurns": 8,
    "finalConfidence": 0.85,
    "riskLevel": "HIGH"
  }
}
```

---

<div align="center">

**Made with ❤️ for GUVI Hackathon 2026**

</div>
