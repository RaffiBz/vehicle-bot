// ============================================
// BOT.JS - Telegraf Bot Setup
// Main bot configuration and handler registration
// ============================================

import { Telegraf } from "telegraf";
import {
  handleStart,
  handleHelp,
  handlePhoto,
  handleLanguageSelection,
  handleColorSelection,
  handleTextureSelection,
  handleResultAction,
  handleText,
} from "./handlers.js";

/**
 * Create and configure the Telegram bot
 * @param {string} token - Bot token from BotFather
 * @returns {Telegraf} Configured bot instance
 */
export function createBot(token) {
  const bot = new Telegraf(token);

  // ==========================================
  // COMMANDS
  // ==========================================

  // /start - Begin the flow
  bot.start(handleStart);

  // /help - Show instructions
  bot.help(handleHelp);

  // ==========================================
  // PHOTO HANDLER
  // Handles vehicle image uploads
  // ==========================================
  bot.on("photo", handlePhoto);

  // ==========================================
  // CALLBACK QUERIES (Button clicks)
  // Pattern matching for different button types
  // ==========================================

  // Language selection: lang_ru, lang_am
  bot.action(/^lang_/, handleLanguageSelection);

  // Color selection: color_red, color_blue, etc.
  bot.action(/^color_/, handleColorSelection);

  // Texture selection: texture_gloss, texture_matte
  bot.action(/^texture_/, handleTextureSelection);

  // Result actions: result_another, result_call
  bot.action(/^result_/, handleResultAction);

  // ==========================================
  // TEXT MESSAGE HANDLER
  // Catches any text that isn't a command
  // ==========================================
  bot.on("text", handleText);

  // ==========================================
  // ERROR HANDLING
  // Global error handler for the bot
  // ==========================================
  bot.catch((err, ctx) => {
    // Log full error to terminal only
    console.error("❌ Bot error:", err.message);

    // Don't send error messages for callback query timeouts
    if (err.message?.includes("query is too old")) {
      return;
    }

    // Don't spam user with errors - just log
    // Individual handlers already send clean error messages
  });

  return bot;
}
