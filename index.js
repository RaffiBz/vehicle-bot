// ============================================
// INDEX.JS - Application Entry Point
// Dave Wrap - Vehicle Color Changer Bot
// ============================================

import "dotenv/config";
import { createBot } from "./src/bot.js";

console.log("🔧 Starting bot...");

// Validate environment variables
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is required in .env file");
  process.exit(1);
}

if (!process.env.N8N_WEBHOOK_URL) {
  console.error("❌ N8N_WEBHOOK_URL is required in .env file");
  process.exit(1);
}

// Create and start the bot
const bot = createBot(process.env.BOT_TOKEN);

console.log("📡 Connecting to Telegram...");

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Launch!
bot
  .launch()
  .then(() => {
    console.log("🚗 Dave Wrap Bot is running!");
    console.log("📊 Daily limit per user:", 10);
    console.log("🔗 n8n webhook:", process.env.N8N_WEBHOOK_URL);
  })
  .catch((err) => {
    console.error("❌ Failed to start bot:", err);
    process.exit(1);
  });
