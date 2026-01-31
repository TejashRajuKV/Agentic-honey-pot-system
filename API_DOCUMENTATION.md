# Agentic Honey-Pot System - API Documentation

## 🎯 Overview
REST API for an AI-powered honeypot system that detects scammers and autonomously engages them to extract intelligence.

## 🔑 Authentication
All API endpoints require an API key in the request header:

```
x-api-key: honeypot_secret_key_2026
```

## 📡 Base URL
```
http://localhost:3000/api/v1
```

## 🛣️ API Endpoints

### 1. Health Check
**GET /** 

Check if the server is running.

**Response:**
```json
{
  "message": "Agentic Honey-Pot Backend is running 🐝"
}
```

---

### 2. Handle Incoming Message
**POST /api/v1/messages**

Main endpoint to send messages and receive AI-generated responses.

**Headers:**
```
Content-Type: application/json
x-api-key: honeypot_secret_key_2026
```

**Request Body:**
```json
{
  "sessionId": "session_123",
  "message": "Your account will be blocked. Please verify your KYC immediately.",
  "platform": "whatsapp",
  "sender": "+919876543210"
}
```

**Required Fields:**
- `sessionId` (string): Unique identifier for the conversation session
- `message` (string): The message content

**Optional Fields:**
- `platform` (string): Communication platform (e.g., "whatsapp", "telegram", "sms")
- `sender` (string): Sender identifier (phone number, username, etc.)

**Response:**
```json
{
  "sessionId": "session_123",
  "reply": "Oh, I got a message about KYC? What do I need to do?",
  "isScam": true,
  "confidence": 0.85,
  "engagementPhase": "early",
  "status": "active"
}
```

**Response Fields:**
- `sessionId`: Session identifier
- `reply`: AI-generated response to send back
- `isScam`: Boolean indicating if scam was detected
- `confidence`: Scam detection confidence score (0-1)
- `engagementPhase`: Current phase: "early", "mid", "late", or "final"
- `status`: Session status: "active", "terminated", or "blocked"

**Debug Mode (NODE_ENV=development):**
When in development mode, additional debug information is included:
```json
{
  "sessionId": "session_123",
  "reply": "...",
  "isScam": true,
  "confidence": 0.85,
  "engagementPhase": "early",
  "status": "active",
  "debug": {
    "detectedCategories": ["banking", "urgency"],
    "extractedIntel": {
      "upiIds": [],
      "phoneNumbers": [],
      "urls": [],
      "scamPhrases": ["kyc", "verify your account", "account will be blocked"],
      "behavioralPatterns": ["urgency_tactics", "threat_of_consequences"]
    }
  }
}
```

---

### 3. Get Session Details
**GET /api/v1/sessions/:sessionId**

Retrieve details about a specific session (for monitoring/debugging).

**Headers:**
```
x-api-key: honeypot_secret_key_2026
```

**Response:**
```json
{
  "session": {
    "sessionId": "session_123",
    "platform": "whatsapp",
    "sender": "+919876543210",
    "status": "active",
    "isScam": true,
    "engagementPhase": "mid",
    "createdAt": "2026-01-31T16:15:00.000Z",
    "lastActiveAt": "2026-01-31T16:20:00.000Z",
    "finalCallbackSent": false
  },
  "conversationTurns": 6,
  "extractedIntelligence": {
    "upiIds": ["scammer@paytm"],
    "phoneNumbers": ["9876543210"],
    "urls": ["http://fake-bank-verify.com"],
    "scamPhrases": ["kyc", "verify account", "urgent action required"],
    "behavioralPatterns": ["urgency_tactics", "authority_impersonation", "information_solicitation"]
  }
}
```

---

## 🎭 System Behavior

### Scam Detection
The system automatically detects scam intent based on:
- Banking/UPI fraud keywords (kyc, verify account, block account, OTP, CVV, etc.)
- Phishing patterns (click link, claim prize, won lottery, etc.)
- Fake offers (limited offer, free gift, guaranteed returns, etc.)
- Urgency tactics (urgent, immediate, expires today, etc.)
- Contact requests (send details, share number, whatsapp, etc.)

### Engagement Phases
1. **Early** (0-2 turns): Show initial interest, ask clarifying questions
2. **Mid** (3-5 turns): Show growing trust, ask for more details
3. **Late** (6-8 turns): Show willingness to comply, request procedures
4. **Final** (9+ turns): Prepare to take action, extract final details

### Intelligence Extraction
The system automatically extracts:
- **UPI IDs**: Patterns like `something@paytm`, `user@phonepe`, etc.
- **Phone Numbers**: Indian mobile numbers (10 digits starting with 6-9)
- **URLs**: Any web links including phishing sites
- **Scam Phrases**: Common scam keywords and phrases
- **Behavioral Patterns**: Urgency tactics, authority impersonation, threats, etc.

### Session Termination
The conversation automatically wraps up when:
- 10+ conversation turns have occurred, OR
- Significant intelligence has been extracted AND 6+ turns have elapsed

Upon termination:
- Session status changes to "terminated"
- A final callback is sent to the evaluation platform (if configured)
- Intelligence report is logged

---

## 🔧 Configuration

### Environment Variables (`.env`)
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/honeypot
API_KEY=honeypot_secret_key_2026
LLM_API_KEY=your_llm_api_key_here
EVALUATION_CALLBACK_URL=https://evaluation-platform.example.com/callback
NODE_ENV=development
```

**Variable Descriptions:**
- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `API_KEY`: API key for authentication
- `LLM_API_KEY`: API key for LLM service (Gemini/GPT/Claude) - optional, uses rule-based responses if not set
- `EVALUATION_CALLBACK_URL`: Endpoint to receive final intelligence reports
- `NODE_ENV`: Environment mode (development/production)

---

## 🚀 Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## 📊 Testing Examples

### Example 1: Banking Scam Detection
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: honeypot_secret_key_2026" \
  -d '{
    "sessionId": "test_001",
    "message": "Your account will be blocked due to pending KYC. Verify immediately.",
    "platform": "sms"
  }'
```

### Example 2: Phishing Attempt
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: honeypot_secret_key_2026" \
  -d '{
    "sessionId": "test_002",
    "message": "Congratulations! You won ₹50,000. Click this link to claim: http://fake-lottery.com",
    "platform": "whatsapp"
  }'
```

### Example 3: Get Session Details
```bash
curl -X GET http://localhost:3000/api/v1/sessions/test_001 \
  -H "x-api-key: honeypot_secret_key_2026"
```

---

## 🛡️ Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "required": ["sessionId", "message"]
}
```

### 401 Unauthorized
```json
{
  "error": "Missing API key",
  "message": "Please provide an API key in the x-api-key header"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid"
}
```

### 404 Not Found
```json
{
  "error": "Session not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details..."
}
```

---

## 📦 Database Schema

### Session Model
```javascript
{
  sessionId: String (unique),
  platform: String,
  sender: String,
  createdAt: Date,
  lastActiveAt: Date,
  status: String ("active" | "terminated" | "blocked"),
  isScam: Boolean,
  engagementPhase: String ("early" | "mid" | "late" | "final"),
  finalCallbackSent: Boolean
}
```

### ConversationTurn Model
```javascript
{
  sessionId: String,
  turnIndex: Number,
  role: String ("user" | "agent"),
  text: String,
  timestamp: Date,
  detectedScamIntent: Boolean,
  extractedIntel: {
    upiIds: [String],
    phoneNumbers: [String],
    urls: [String],
    scamPhrases: [String],
    behavioralPatterns: [String]
  }
}
```

---

## 🎯 Callback Payload

When a session terminates, the following payload is sent to `EVALUATION_CALLBACK_URL`:

```json
{
  "sessionId": "session_123",
  "timestamp": "2026-01-31T16:30:00.000Z",
  "intelligence": {
    "upiIds": ["scammer@paytm"],
    "phoneNumbers": ["9876543210"],
    "urls": ["http://fake-bank-verify.com"],
    "scamPhrases": ["kyc", "verify account", "urgent"],
    "behavioralPatterns": ["urgency_tactics", "authority_impersonation"]
  },
  "sessionMetadata": {
    "platform": "whatsapp",
    "sender": "+919876543210",
    "totalTurns": 10,
    "duration": 300,
    "engagementPhase": "final",
    "scamConfidence": 0.9
  },
  "summary": {
    "scamDetected": true,
    "intelligenceExtracted": true,
    "totalIntelItems": 3
  }
}
```
