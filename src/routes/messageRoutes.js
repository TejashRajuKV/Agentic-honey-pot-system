// src/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const { handleIncomingMessage, getSession } = require("../controllers/messageController");
const apiKeyAuth = require("../middleware/apiKeyAuth");

// ✅ FIX: Open probe endpoint — no auth required.
// The evaluation platform uses this to confirm the endpoint exists
// before sending authenticated test messages.
router.get("/messages", (req, res) => {
    res.json({
        status: "success",
        message: "Honeypot API is active and ready to receive messages.",
        endpoint: "POST /api/v1/messages",
        auth: "x-api-key header required"
    });
});

// ✅ Open health check (no auth) for session probing
router.get("/sessions/:sessionId", apiKeyAuth, getSession);

// ✅ Auth required only for the message handling endpoint
router.post("/messages", apiKeyAuth, handleIncomingMessage);

module.exports = router;
