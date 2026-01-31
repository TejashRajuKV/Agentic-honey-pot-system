# Gemini AI Integration Guide

## ✨ Status: ACTIVATED!

Your honeypot now uses **Google Gemini Pro** for intelligent responses!

## 🔧 Configuration

**File:** `.env`
```
LLM_API_KEY=AIzaSyDiWf5ZLPWQXyH-7jqje_m348lovqEhGVU
```

## 🚀 How It Works

1. **Server starts** → Gemini API initializes automatically
2. **Message received** → Gemini generates contextual response
3. **API fails?** → Automatically falls back to rule-based responses

## 🧪 Testing Gemini Responses

Restart your server to activate Gemini:

```bash
# Stop current server (Ctrl+C)
npm run dev
```

You should see:
```
✅ Gemini API initialized successfully
Server running on http://localhost:3000
```

Then test with interactive chat:
```bash
node interactive-test.js
```

## 💬 Gemini vs Rule-Based Responses

### Rule-Based (Old)
```
You: Your account will be blocked
Agent: That sounds serious. What should I do?
```

### Gemini AI (New) 🤖
```
You: Your account will be blocked
Agent: Oh no, my account is being blocked? I'm really worried now. 
       Is there something specific I need to verify? I don't want 
       to lose access to my account.
```

Gemini provides:
- ✅ More natural, human-like responses
- ✅ Better context awareness
- ✅ Adaptive conversation flow
- ✅ Subtler intelligence extraction

## 🎯 Conversation Phases with Gemini

### Early Phase (Turns 1-2)
- Shows concern and asks questions
- "This seems urgent, what exactly happened?"

### Mid Phase (Turns 3-5)
- Builds trust, requests more details
- "I understand. What information do you need from me?"

### Late Phase (Turns 6-8)
- Shows readiness to comply
- "I'll do whatever is needed. Where should I send it?"

### Final Phase (Turns 9+)
- Extracts final details then terminates
- System sends intelligence report to callback URL

## 🔍 Monitoring Gemini

Check console logs:
```
🤖 Gemini response (early phase): Oh no, what should I do?
🤖 Gemini response (mid phase): I'm ready to verify...
```

## ⚠️ Fallback System

If Gemini fails (rate limit, network error, etc.):
```
❌ Gemini API error: API quota exceeded
   Falling back to rule-based response
```

The agent continues working with rule-based responses - **no downtime!**

## 🎨 Customizing Gemini Behavior

Edit `agent/personaPrompts.js` to change:
- Agent personality
- Response style
- Intelligence extraction tactics
- Engagement strategies

## 📊 Cost Considerations

**Gemini Pro Pricing:**
- Free tier: 60 requests/minute
- Paid tier: $0.00025 per 1000 characters

**Your honeypot:**
- ~1-2 requests per user message
- Free tier = 3,600 messages/hour
- Perfect for testing and moderate use

## ✅ Verification Checklist

- [x] Gemini API key added to `.env`
- [x] `@google/generative-ai` package installed
- [x] Integration code added to `agent/agentService.js`
- [ ] Server restarted to activate Gemini
- [ ] Test with `node interactive-test.js`
- [ ] Check console for "✅ Gemini API initialized"

---

**Your honeypot is now powered by Gemini AI!** 🚀
