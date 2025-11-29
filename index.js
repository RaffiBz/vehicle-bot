import "dotenv/config";
import { createBot } from "./src/bot.js";

const token = process.env.BOT_TOKEN;

console.log("🔧 Starting bot...");
console.log("🔑 Token loaded:", token ? `${token.slice(0, 15)}...` : "MISSING");

if (!token) {
  console.error("ERROR: BOT_TOKEN is not set in .env file");
  process.exit(1);
}

const bot = createBot(token);

console.log("📡 Connecting to Telegram...");

// Start the bot
bot
  .launch()
  .then(() => {
    console.log("🚀 Bot is running!");
    console.log("Press Ctrl+C to stop");
  })
  .catch((err) => {
    console.error("❌ Failed to start bot:", err.message);
    process.exit(1);
  });

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
