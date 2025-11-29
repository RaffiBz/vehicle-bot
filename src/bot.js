import { Telegraf } from "telegraf";
import {
  handleStart,
  handleHelp,
  handlePhoto,
  handleColorSelection,
  handleBackgroundChoice,
  handleText,
} from "./handlers.js";

export function createBot(token) {
  const bot = new Telegraf(token);

  // Commands
  bot.start(handleStart);
  bot.help(handleHelp);

  // Photo handler
  bot.on("photo", handlePhoto);

  // Callback queries (button clicks)
  bot.action(/^color_/, handleColorSelection);
  bot.action(/^bg_/, handleBackgroundChoice);

  // Text messages
  bot.on("text", handleText);

  // Error handling
  bot.catch((err, ctx) => {
    console.error("Bot error:", err);
    ctx.reply("❌ An error occurred. Please try again with /start");
  });

  return bot;
}
