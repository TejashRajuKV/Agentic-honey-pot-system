// src/app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());

// Parse JSON with any content-type (GUVI tester may not send Content-Type header)
app.use(express.json({ type: '*/*' }));

// Fallback: ensure req.body is always an object even if parsing fails
app.use((req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
        req.body = {};
    }
    next();
});

// Health check route
app.get("/", (req, res) => {
    res.json({ message: "Agentic Honey-Pot Backend is running 🐝" });
});

// API Routes
const messageRoutes = require("./routes/messageRoutes");
app.use("/api/v1", messageRoutes);

module.exports = app;
