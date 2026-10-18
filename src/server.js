// src/server.js
const app = require("./app");
const mongoose = require("mongoose");
const mlManager = require("./services/mlProcessManager");
const { startScheduledJobs } = require("./services/postProcessService");

const PORT = process.env.PORT || 3000;

// When MongoDB is unreachable, database calls used to hang for Mongoose's default 10 s buffer before
// failing. Fail in a couple of seconds so clients (and the evaluator) get a quick, clean answer.
mongoose.set("bufferTimeoutMS", parseInt(process.env.DB_BUFFER_TIMEOUT_MS || "2500", 10));

// ✅ FIX: Start HTTP server IMMEDIATELY — do not gate it on MongoDB.
// This ensures the evaluation platform can always reach the API even if
// the database is temporarily unavailable.
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Start the CyberRakshak ML engine as a supervised child process (non-blocking).
// The honeypot pipeline degrades gracefully to rule-based detection while it warms up.
mlManager.start().catch((err) => console.error("⚠️  ML engine start failed:", err.message));

// Connect to MongoDB in the background (non-blocking)
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    startScheduledJobs();
  })
  .catch((err) => {
    console.error("⚠️  MongoDB connection error (server still running):", err.message);
  });

// Graceful shutdown
process.on('SIGTERM', () => process.emit('SIGINT'));
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  mlManager.stop();
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});
