// src/server.js
const app = require("./app");
const mongoose = require("mongoose");
const telegramBot = require("./telegram/telegramBot");

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Initialize Telegram bot
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
    console.error("MongoDB connection error:", err);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  telegramBot.stop();
  process.exit(0);
});
