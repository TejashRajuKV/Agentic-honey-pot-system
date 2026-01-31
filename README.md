# Agentic Honey-Pot System - README

## 🐝 Overview
An AI-powered backend service that detects scam messages and autonomously engages scammers in realistic conversations to extract valuable intelligence—without revealing that detection has occurred.

## 🎯 Key Features
- ✅ **Scam Detection**: Pattern-based detection for banking fraud, UPI scams, phishing, and fake offers
- 🤖 **AI Agent**: Autonomous conversational agent that mimics human behavior
- 🔍 **Intelligence Extraction**: Automatically extracts UPI IDs, phone numbers, URLs, and behavioral patterns
- 📊 **Session Management**: Tracks multi-turn conversations with engagement phases
- 🔒 **Secure API**: API key-based authentication
- 📡 **Callback Integration**: Sends intelligence reports to evaluation platform

## 🛠️ Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (with Mongoose)
- **AI/LLM**: Supports Gemini/GPT/Claude (with rule-based fallback)
- **Security**: API key authentication, input sanitization

## 📁 Project Structure
```
honeypot-backend/
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app configuration
│   ├── models/
│   │   ├── Session.js         # Session schema
│   │   └── ConversationTurn.js # Conversation turn schema
│   ├── controllers/
│   │   └── messageController.js # Message handling logic
│   ├── services/
│   │   ├── scamDetectionService.js      # Scam pattern detection
│   │   ├── agentService.js              # AI response generation
│   │   ├── intelExtractionService.js    # Intelligence extraction
│   │   ├── sessionService.js            # Session management
│   │   └── callbackService.js           # Evaluation callback
│   ├── middleware/
│   │   └── apiKeyAuth.js      # API key authentication
│   ├── routes/
│   │   └── messageRoutes.js   # API routes
│   ├── utils/
│   │   └── helpers.js         # Utility functions
│   └── config/
│       └── db.js              # Database config
├── .env                       # Environment configuration
├── package.json
└── API_DOCUMENTATION.md       # Detailed API docs
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone/Navigate to the project**
```bash
cd "d:\guvi hackathon"
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Edit `.env` file:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/honeypot
API_KEY=honeypot_secret_key_2026
LLM_API_KEY=your_llm_api_key_here
EVALUATION_CALLBACK_URL=https://evaluation-platform.example.com/callback
NODE_ENV=development
```

4. **Start MongoDB**
Make sure MongoDB is running locally or use MongoDB Atlas.

5. **Run the server**

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📖 Usage

### Basic API Call
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: honeypot_secret_key_2026" \
  -d '{
    "sessionId": "demo_session_1",
    "message": "Your account will be blocked. Verify KYC now!",
    "platform": "whatsapp"
  }'
```

### Expected Response
```json
{
  "sessionId": "demo_session_1",
  "reply": "My account will be blocked? That's concerning. How can I prevent this?",
  "isScam": true,
  "confidence": 0.85,
  "engagementPhase": "early",
  "status": "active"
}
```

## 🔄 System Flow

1. **External platform sends message** → `/api/v1/messages`
2. **API validates** API key
3. **System detects** scam intent
4. **If scam detected**:
   - AI agent generates human-like response
   - Intelligence is extracted silently
   - Conversation continues autonomously
5. **After sufficient engagement**:
   - Session terminates
   - Final callback sent to evaluation endpoint

## 🧪 Testing Scenarios

### Scenario 1: Banking Fraud
**User Message**: "Your UPI has been blocked. Send OTP to verify: fake-link.com"

**System Response**: 
- Detects scam (confidence: 0.9)
- Extracts: URL, scam phrases
- Replies: "I'll get the OTP. Where should I send it?"

### Scenario 2: Phishing
**User Message**: "Congratulations! Click here to claim ₹50,000 prize"

**System Response**:
- Detects scam (confidence: 0.75)
- Extracts: behavioral patterns
- Replies: "Really? That sounds interesting! How does this work?"

### Scenario 3: Normal Message
**User Message**: "Hello, how are you?"

**System Response**:
- No scam detected
- Replies: "Thank you for your message."

## 📊 Intelligence Extracted

The system automatically identifies and extracts:

- 💳 **UPI IDs**: `scammer@paytm`, `fraud@phonepe`
- 📱 **Phone Numbers**: Indian mobile numbers (10 digits)
- 🔗 **URLs**: Phishing links and fake websites
- 🚨 **Scam Phrases**: "verify account", "send OTP", "urgent"
- 🎭 **Behavioral Patterns**: 
  - Urgency tactics
  - Authority impersonation
  - Information solicitation
  - Threat of consequences
  - Reward promises
  - External communication requests

## 🔒 Security Features

- ✅ API key authentication on all endpoints
- ✅ Input sanitization (XSS protection)
- ✅ Request validation
- ✅ MongoDB injection prevention (via Mongoose)
- ✅ CORS enabled for cross-origin requests
- ✅ Environment-based configuration

## 🎭 AI Agent Behavior

The agent adapts responses based on:
- **Scam type detected** (banking, phishing, fake offers)
- **Conversation phase** (early, mid, late, final)
- **Extracted intelligence** (adjusts strategy based on what's collected)

The agent:
- Acts completely human
- Shows appropriate curiosity/concern
- Never reveals it's an AI
- Maintains conversation flow naturally
- Extracts information through subtle questioning

## 📡 Deployment

### Deploy to Render / Railway

1. **Connect your Git repository**
2. **Set environment variables** in the dashboard:
   - `MONGODB_URI` (use MongoDB Atlas)
   - `API_KEY`
   - `LLM_API_KEY` (optional)
   - `EVALUATION_CALLBACK_URL`
   - `NODE_ENV=production`

3. **Deploy command**: `npm start`
4. **Your API will be available at**: `https://your-app.render.com/api/v1/messages`

## 🤝 Contributing

This is a hackathon project for GUVI. Team members can contribute by:
- Enhancing scam detection patterns
- Improving AI agent responses
- Adding more intelligence extraction patterns
- Optimizing performance

## 📝 API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed endpoint documentation.

## 🐛 Troubleshooting

### MongoDB Connection Error
```
MongoDB connection error: MongooseServerSelectionError
```
**Solution**: Ensure MongoDB is running or check your `MONGODB_URI`

### API Key Error
```
{ "error": "Invalid API key" }
```
**Solution**: Make sure you're sending the correct API key in the `x-api-key` header

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change the `PORT` in `.env` or kill the process using port 3000

## 📞 Support

For questions or issues, contact the development team.

---

Made with ❤️ for GUVI Hackathon 2026
