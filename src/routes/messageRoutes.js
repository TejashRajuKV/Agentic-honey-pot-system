// src/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const { handleIncomingMessage, getSession } = require("../controllers/messageController");
const apiKeyAuth = require("../middleware/apiKeyAuth");

// Apply API key authentication to all routes
router.use(apiKeyAuth);

// Main message handling endpoint
router.post("/messages", handleIncomingMessage);

// Session details endpoint (optional, for monitoring)
router.get("/sessions/:sessionId", getSession);

module.exports = router;
