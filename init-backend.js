// init-backend.js
const fs = require("fs");
const path = require("path");

const root = __dirname;

const structure = [
  "src/server.js",
  "src/app.js",
  "src/routes/index.js",
  "src/controllers/messageController.js",
  "src/middleware/apiKeyAuth.js",
  "src/config/db.js",
  "src/models/Session.js",
  "src/models/ConversationTurn.js",
  "src/services/sessionService.js",
  "src/services/scamDetectionService.js",
  "src/services/agentService.js",
  "src/services/intelExtractionService.js",
  "src/services/callbackService.js",
  "src/utils/helpers.js"
];

structure.forEach(file => {
  const filePath = path.join(root, file);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
    console.log("Created:", file);
  }
});
