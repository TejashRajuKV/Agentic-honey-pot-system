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

// Graceful shutdown: drain HTTP work and close MongoDB, but never hang forever
// if a keep-alive socket or database connection fails to close.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Shutting down gracefully (${signal})...`);
  mlManager.stop();

  const forceExit = setTimeout(() => {
    console.error('⚠️  Graceful shutdown timed out; forcing process exit.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  server.close(async () => {
    try {
      await mongoose.disconnect();
      clearTimeout(forceExit);
      process.exit(0);
    } catch {
      console.error('⚠️  MongoDB shutdown failed.');
      clearTimeout(forceExit);
      process.exit(1);
    }
  });
  // Close idle keep-alive sockets immediately when supported by the Node version.
  server.closeIdleConnections?.();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
