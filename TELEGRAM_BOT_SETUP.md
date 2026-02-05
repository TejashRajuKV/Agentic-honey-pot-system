+# 🤖 Telegram Bot Setup Guide

## Quick Setup (5 minutes)

### Step 1: Create Your Bot

1. **Open Telegram** on your phone or computer

2. **Search for @BotFather** (official Telegram bot creator)

3. **Start a chat** and send: `/newbot`

4. **Choose a name** for your bot:
   ```
   Example: Honeypot Scam Detector
   ```

5. **Choose a username** (must end with 'bot'):
   ```
   Example: yourhoneypot_bot
   ```

6. **Copy the token** you receive. It looks like:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
   ```

### Step 2: Add Token to Environment

Add this line to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_token_here
```

Replace `your_token_here` with the token from BotFather.

### Step 3: Restart Server

```bash
npm run dev
```

You should see:
```
✅ Telegram Bot initialized: @yourhoneypot_bot
📱 Users can message: https://t.me/yourhoneypot_bot
🤖 Telegram Bot is active and ready!
```

### Step 4: Test It!

1. Open Telegram
2. Search for your bot: `@yourhoneypot_bot`
3. Send `/start`
4. Try scamming it!

---

## 🎮 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/help` | Show help and command list |
| `/stats` | View current session statistics |
| `/report` | Get detailed scam analysis |
| `/reset` | Start a new conversation |

---

## 💬 How to Demo to Judges

### **Live Demo Script**

1. **Show the bot link**: 
   ```
   "Here's my live bot: https://t.me/yourhoneypot_bot"
   ```

2. **Send /start command**:
   - Shows professional welcome message
   - Lists features and capabilities

3. **Try a scam message**:
   ```
   "Your bank account will be blocked. 
   Send OTP code immediately to verify."
   ```

4. **Bot responds naturally**:
   - Looks like a confused human
   - Behind scenes: detecting patterns

5. **Show /stats command**:
   - Real-time detection status
   - Probability scores
   - Intelligence extracted

6. **Show /report command**:
   - Detailed analysis
   - Risk assessment
   - Safety advice
   - Scam classification

### **Key Talking Points**

✅ **"This is a LIVE bot - you can test it right now"**
- Judges can scan QR code
- Interact directly from phone
- See detection in real-time

✅ **"It runs on the same API as the backend"**
- Reuses all 7 advanced features
- Same intelligence extraction
- Same behavioral profiling

✅ **"Multi-platform ready"**
- Currently: Telegram
- Same code works for: WhatsApp (with Business API)
- Framework for: Discord, Slack, etc.

---

## 🚀 Deployment

### Deploy to Render/Railway/Heroku

1. **Add environment variable**:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   ```

2. **Deploy normally**:
   ```bash
   git push origin main
   ```

3. **Bot auto-starts** when server starts

4. **Test via Telegram** - works instantly!

### Important Notes

- ✅ Bot works with polling (no webhooks needed initially)
- ✅ Automatic reconnection on server restart
- ✅ Graceful shutdown on SIGINT
- ✅ Error handling for network issues

---

## 🎯 Example Scam Tests

Try these with your bot to showcase detection:

### 1. **OTP Fraud**
```
Your HDFC account will be blocked today. 
To verify, share the OTP sent to your mobile.
```

### 2. **Payment Scam**
```
This is IRCTC. Your ticket booking failed. 
Send Rs. 500 to upi-id@paytm to confirm.
```

### 3. **Prize Scam**
```
Congratulations! You won Rs. 10 lakhs in lucky draw. 
To claim, pay processing fee of Rs. 2000.
```

### 4. **Authority Impersonation**
```
I am calling from Income Tax Department. 
Your PAN card will be blocked. Share details urgently.
```

### 5. **Hinglish Test (UNIQUE!)**
```
Aapka account block ho jayega kal. 
Urgent OTP bhejo verification k liye.
```

### Expected Bot Behavior

- ✅ Responds naturally (confused, scared, asking questions)
- ✅ Extracts intelligence (UPI IDs, amounts, patterns)
- ✅ Detects scam with high probability
- ✅ Provides detailed analysis on /report
- ✅ Shows safety advice and reasoning

---

## 📊 Features Demonstrated

Every bot interaction showcases:

1. **Advanced Detection** - Multi-layered scam analysis
2. **Intelligent Responses** - Context-aware, natural conversations
3. **Real-Time Analysis** - Instant risk assessment
4. **Multi-Language** - Hindi/Hinglish support
5. **Intelligence Extraction** - UPI/phone/URL capture
6. **Behavioral Profiling** - Pressure velocity, vulnerability
7. **Quality Monitoring** - Response quality tracking

---

## 🐛 Troubleshooting

### Bot doesn't respond
1. Check token is correct in `.env`
2. Restart server: `npm run dev`
3. Look for "Bot initialized" message in console

### "Unauthorized" error
- Token is invalid
- Get new token from @BotFather: `/token`

### Bot is slow
- Normal for free Telegram API
- Heroku/Render may have cold starts
- Keep-alive pings can help (optional)

### Bot stops after inactivity
- Free tier servers sleep after 30 min
- First message wakes it up (30s delay)
- Paid tier solves this

---

## 💡 Advanced Features (Optional)

### Add Webhook (Production)
Replace polling with webhooks for better performance:

```javascript
// Instead of polling mode
const bot = new TelegramBot(token, { 
  webhook: { port: process.env.PORT } 
});
bot.setWebHook(`https://your-domain.com/bot${token}`);
```

### Add Inline Buttons
```javascript
bot.sendMessage(chatId, 'Choose action:', {
  reply_markup: {
    inline_keyboard: [[
      { text: '📊 Stats', callback_data: 'stats' },
      { text: '📄 Report', callback_data: 'report' }
    ]]
  }
});
```

---

## 🏆 Judge Impact

**Why This Matters**:

1. **Tangible Product** - Not just API, actual usable bot
2. **Live Demo** - Judges can test immediately
3. **Production-Ready** - Already deployed and working
4. **Multi-Platform** - Framework for WhatsApp, Discord, etc.
5. **Professional** - Commands, error handling, reports

**Differentiator**: 90% of teams show APIs. You show a **LIVE BOT** that judges can message right now!

---

## 📸 Screenshots for Documentation

1. `/start` command - Welcome screen
2. Scam conversation - Natural responses
3. `/stats` command - Real-time statistics
4. `/report` command - Detailed analysis
5. High-risk alert - Automatic warnings

Take these screenshots and add to presentation!

---

## ✅ Verification Checklist

Before demo:

- [ ] Bot responds to `/start`
- [ ] Bot detects obvious scam (try "send OTP")
- [ ] `/stats` shows accurate data
- [ ] `/report` generates detailed analysis
- [ ] `/reset` clears conversation
- [ ] Bot works on mobile Telegram
- [ ] Bot URL is public and shareable
- [ ] Server logs show bot initialization

---

**You're ready to WOW the judges!** 🚀

Your bot link: `https://t.me/your_bot_username`

Share this with judges and let them test it live!
