// src/app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
    res.json({ message: "Agentic Honey-Pot Backend is running 🐝" });
});

// API Routes
const messageRoutes = require("./routes/messageRoutes");
app.use("/api/v1", messageRoutes);

module.exports = app;

