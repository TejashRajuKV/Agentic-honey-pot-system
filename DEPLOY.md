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
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`

3. **Set Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/honeypot
   API_KEY=your_secure_api_key_here
   PORT=3000
   NODE_ENV=production
   EVALUATION_CALLBACK_URL=https://your-evaluation-endpoint.com/callback
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
   EVALUATION_CALLBACK_URL=https://your-evaluation-endpoint.com/callback
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
| `EVALUATION_CALLBACK_URL` | No | Callback endpoint URL | `https://eval.com/callback` |
| `LLM_API_KEY` | No | LLM API key (optional) | `gemini_key_xxx` |

---

**Deployment complete! Your Agentic Honey-Pot System is now live.** 🎉
