# Agentic Honey-Pot Backend

##  Deployment Guide

This document provides step-by-step deployment instructions for the Agentic Honey-pot System.

## 📋 Prerequisites

- MongoDB Atlas account (or local MongoDB for development)
- Deployment platform account (Render, Railway, or Heroku)
- Git repository

## 🚀 Deployment Steps

### 1. MongoDB Setup (Production)

1. **Create MongoDB Atlas Account**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Create free tier cluster

2. **Configure Database**
   - Create a new database named `honeypot`
   - Create a database user with read/write permissions
   - Get your connection string

3. **Whitelist IP Addresses**
   - In Network Access, allow access from anywhere (0.0.0.0/0)
   - Or add your deployment platform's IP ranges

### 2. Deploy to Render

1. **Connect Repository**
   - Go to [render.com](https://render.com)
   - Create new Web Service
   - Connect your GitHub repository

2. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Runtime requirements: Node.js 18+, Python 3.10+, and the packages in `requirements.txt` if the gateway will supervise the ML engine.
   - If the host cannot run Python, deploy the ML service separately, install its Python dependencies there, and set `ML_AUTO_START=false` plus `CYBERRAKSHAK_URL` on the gateway.

3. **Set Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/honeypot
   API_KEY=your_secure_api_key_here
   PORT=3000
   NODE_ENV=production
   CONSOLE_PASSWORD=use-a-unique-password-at-least-12-characters
   CONSOLE_SESSION_SECRET=generate-at-least-32-random-bytes
   # Leave EVALUATION_CALLBACK_URL unset to use the required default evaluator.
   LLM_API_KEY=your_llm_key (optional)
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Your API will be available at: `https://your-app.onrender.com`

### 3. Deploy to Railway

1. **Create New Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Configure Service**
   - Railway auto-detects Node.js
   - Set start command: `npm start`

3. **Add MongoDB Plugin**
   - Click "New" → "Database" → "MongoDB"
   - Copy the MongoDB connection URL

4. **Set Environment Variables**
   ```
   MONGODB_URI=${{MongoDB.MONGO_URL}}
   API_KEY=your_secure_api_key_here
   PORT=${{PORT}}
   NODE_ENV=production
   CONSOLE_PASSWORD=use-a-unique-password-at-least-12-characters
   CONSOLE_SESSION_SECRET=generate-at-least-32-random-bytes
   # Leave EVALUATION_CALLBACK_URL unset to use the required default evaluator.
   ```

5. **Deploy**
   - Railway automatically deploys on git push

### 4. Deploy to Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create honeypot-backend
   ```

3. **Add MongoDB Add-on**
   ```bash
   heroku addons:create mongodb:sandbox
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set API_KEY=your_secure_api_key_here
   heroku config:set NODE_ENV=production
   heroku config:set EVALUATION_CALLBACK_URL=https://your-endpoint.com/callback
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

## Release preflight

After configuring production environment variables and installing the frontend and Python dependencies, run:

```bash
npm run release:check
```

This builds the React console and checks the production database URI, API key, console credentials, callback URL syntax, frontend artifact, and Python ML dependencies (unless the ML service is external). It does not replace a deployed smoke test or service-specific health checks.

## 🔒 Security Checklist

- [ ] Change default API key to a strong, random value
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic on Render/Railway)
- [ ] Whitelist specific IPs in MongoDB if possible
- [ ] Set up monitoring and logging
- [ ] Regularly update dependencies

## 🧪 Testing Deployed API

```bash
# Test health endpoint
curl https://your-app.onrender.com/

# Test message endpoint
curl -X POST https://your-app.onrender.com/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "sessionId": "test_001",
    "message": "Your account will be blocked",
    "platform": "test"
  }'
```

## 📊 Monitoring

### Logs
```bash
# Render: View logs in dashboard
# Railway: railway logs
# Heroku: heroku logs --tail
```

### Metrics to Monitor
- API response times
- MongoDB connection status
- Error rates
- Active sessions count
- Intelligence extraction rates

## 🔄 Updates

To deploy updates:

```bash
git add .
git commit -m "Update message"
git push origin main
```

Most platforms auto-deploy on push to main branch.

## ⚙️ Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3000` |
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb+srv://...` |
| `API_KEY` | Yes | API authentication key | `secure_random_key_123` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `EVALUATION_CALLBACK_URL` | No | Public HTTPS callback override; leave unset to use the default evaluator | *(unset)* |
| `CONSOLE_PASSWORD` | Yes in production | Console password (at least 12 characters) | *(secret)* |
| `CONSOLE_SESSION_SECRET` | Yes in production | HMAC signing secret (at least 32 bytes) | *(secret)* |
| `CYBERRAKSHAK_URL` | If ML is external | Base URL of separately hosted ML service | `http://127.0.0.1:5050` |
| `LLM_API_KEY` | No | LLM API key (optional) | `gemini_key_xxx` |

---

**Deployment complete! Your Agentic Honey-Pot System is now live.** 🎉
