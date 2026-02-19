// src/server.js
const app = require("./app");
const mongoose = require("mongoose");
const telegramBot = require("./telegram/telegramBot");

const PORT = process.env.PORT || 3000;

// ✅ FIX: Start HTTP server IMMEDIATELY — do not gate it on MongoDB.
// This ensures the evaluation platform can always reach the API even if
// the database is temporarily unavailable.
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Connect to MongoDB in the background (non-blocking)
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // Initialize Telegram bot after DB is ready
    try {
      const botInitialized = await telegramBot.initialize();
      if (botInitialized) {
        console.log("🤖 Telegram Bot is active and ready!");
      }
    } catch (error) {
      console.log("⚠️  Telegram bot not started (optional feature)");
    }
  })
  .catch((err) => {
    console.error("⚠️  MongoDB connection error (server still running):", err.message);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  telegramBot.stop();
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});
