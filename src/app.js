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

// Serve static files from public directory (dashboard)
app.use(express.static('public'));

// API Routes
const messageRoutes = require("./routes/messageRoutes");
const analyticsRoutes = require("./routes/analytics");
const intelligenceRoutes = require("./routes/intelligence");
const profilerRoutes = require("./routes/profiler");
const alertsRoutes = require("./routes/alerts");
const qualityRoutes = require("./routes/quality");
const reportsRoutes = require("./routes/reports");
const languageRoutes = require("./routes/language");

app.use("/api/v1", messageRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/intelligence", intelligenceRoutes);
app.use("/api/v1/profiles", profilerRoutes);
app.use("/api/v1/alerts", alertsRoutes);
app.use("/api/v1/quality", qualityRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/language", languageRoutes);

module.exports = app;
