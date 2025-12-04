// ============================================
// HANDLERS.JS - Conversation Flow Handlers
// Flow: Language → Photo → Color → Texture → Process → Result
// ============================================

import { Markup } from "telegraf";
import {
  STATES,
  COLORS,
  TEXTURES,
  MESSAGES,
  LANGUAGES,
  CONTACT_PHONE,
  WEEKLY_LIMIT,
} from "./constants.js";
import {
  getSession,
  updateSession,
  resetSession,
  hasExceededLimit,
  incrementUsage,
  getRemainingGenerations,
  getLocalizedMessage,
  acquireLock,
  releaseLock,
  isLocked,
} from "./sessions.js";
import { processVehicleImage } from "./n8n.js";
import { addWatermark } from "./watermark.js";

// ============================================
// HELPERS
// ============================================

async function msg(ctx, messageObj) {
  return await getLocalizedMessage(ctx.chat.id, messageObj);
}

// Safe wrapper for answerCbQuery - ignores expired query errors
async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text);
  } catch (error) {
    // Silently ignore all callback query errors
  }
}

async function getColorName(ctx, colorKey) {
  const session = await getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;
  const color = COLORS.find((c) => c.key === colorKey);
  return color ? color[lang] : colorKey;
}

async function getTextureName(ctx, textureKey) {
  const session = await getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;
  const texture = TEXTURES.find((t) => t.key === textureKey);
  return texture ? texture[lang] : textureKey;
}

// Send error message in user's language (no technical details)
async function sendErrorMessage(ctx) {
  try {
    const errorMsg = await msg(ctx, MESSAGES.ERROR);
    await ctx.reply(errorMsg);
  } catch (e) {
    // Last resort fallback
    await ctx.reply("❌ Error. Please try /start").catch(() => {});
  }
}

// ============================================
// /start COMMAND
// ============================================

export async function handleStart(ctx) {
  try {
    await resetSession(ctx.chat.id);
    await updateSession(ctx.chat.id, { state: STATES.AWAITING_LANGUAGE });

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(MESSAGES.BTN_LANG_RU, "lang_ru"),
        Markup.button.callback(MESSAGES.BTN_LANG_AM, "lang_am"),
      ],
    ]);

    await ctx.reply(MESSAGES.WELCOME, keyboard);
  } catch (error) {
    console.error("handleStart error:", error.message);
    await sendErrorMessage(ctx);
  }
}

// ============================================
// /help COMMAND
// ============================================

export async function handleHelp(ctx) {
  try {
    const message = await msg(ctx, MESSAGES.HELP);
    await ctx.reply(message);
  } catch (error) {
    console.error("handleHelp error:", error.message);
    await sendErrorMessage(ctx);
  }
}

// ============================================
// LANGUAGE SELECTION
// ============================================

export async function handleLanguageSelection(ctx) {
  try {
    const session = await getSession(ctx.chat.id);

    if (session.state !== STATES.AWAITING_LANGUAGE) {
      await safeAnswerCbQuery(ctx, "");
      return;
    }

    const language = ctx.callbackQuery.data.replace("lang_", "");

    if (language !== LANGUAGES.RU && language !== LANGUAGES.AM) {
      await safeAnswerCbQuery(ctx, "");
      return;
    }

    // Check limit before continuing
    if (await hasExceededLimit(ctx.chat.id)) {
      await updateSession(ctx.chat.id, { language });
      await safeAnswerCbQuery(ctx, "⚠️");
      const limitMsg = await msg(ctx, MESSAGES.LIMIT_EXCEEDED);
      await ctx.reply(limitMsg);
      return;
    }

    await updateSession(ctx.chat.id, {
      language,
      state: STATES.AWAITING_VEHICLE_IMAGE,
    });

    const langName = language === LANGUAGES.RU ? "Русский" : "Հայերdelays";
    await safeAnswerCbQuery(ctx, `✅ ${langName}`);
    const sendVehicleMsg = await msg(ctx, MESSAGES.SEND_VEHICLE);
    await ctx.reply(sendVehicleMsg);
  } catch (error) {
    console.error("handleLanguageSelection error:", error.message);
    await safeAnswerCbQuery(ctx, "");
    await sendErrorMessage(ctx);
  }
}

// ============================================
// PHOTO HANDLER
// ============================================

export async function handlePhoto(ctx) {
  try {
    const session = await getSession(ctx.chat.id);
    const photo = ctx.message.photo;
    const fileId = photo[photo.length - 1].file_id;

    if (session.state === STATES.AWAITING_VEHICLE_IMAGE) {
      await handleVehicleImage(ctx, fileId);
    } else {
      const unexpectedMsg = await msg(ctx, MESSAGES.UNEXPECTED_IMAGE);
      await ctx.reply(unexpectedMsg);
    }
  } catch (error) {
    console.error("handlePhoto error:", error.message);
    await sendErrorMessage(ctx);
  }
}

async function handleVehicleImage(ctx, fileId) {
  if (await hasExceededLimit(ctx.chat.id)) {
    const limitMsg = await msg(ctx, MESSAGES.LIMIT_EXCEEDED);
    await ctx.reply(limitMsg);
    return;
  }

  const fileLink = await ctx.telegram.getFileLink(fileId);
  const session = await getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;

  await updateSession(ctx.chat.id, {
    state: STATES.AWAITING_COLOR,
    vehicleImage: fileLink.href,
    vehicleFileId: fileId,
  });

  // Color buttons in user's language
  const colorButtons = COLORS.map((color) =>
    Markup.button.callback(color[lang], `color_${color.key}`)
  );

  // 2 buttons per row
  const keyboard = Markup.inlineKeyboard(
    colorButtons.reduce((rows, button, index) => {
      if (index % 2 === 0) rows.push([]);
      rows[rows.length - 1].push(button);
      return rows;
    }, [])
  );

  const chooseColorMsg = await msg(ctx, MESSAGES.CHOOSE_COLOR);
  await ctx.reply(chooseColorMsg, keyboard);
}

// ============================================
// COLOR SELECTION
// ============================================

export async function handleColorSelection(ctx) {
  try {
    const session = await getSession(ctx.chat.id);

    if (session.state !== STATES.AWAITING_COLOR) {
      await safeAnswerCbQuery(ctx, "");
      return;
    }

    const colorKey = ctx.callbackQuery.data.replace("color_", "");
    const colorDisplay = await getColorName(ctx, colorKey);

    await updateSession(ctx.chat.id, {
      state: STATES.AWAITING_TEXTURE,
      selectedColor: colorKey,
      selectedColorDisplay: colorDisplay,
    });

    await safeAnswerCbQuery(ctx, `✅ ${colorDisplay}`);

    // Texture buttons
    const lang = session.language || LANGUAGES.RU;
    const textureButtons = TEXTURES.map((texture) =>
      Markup.button.callback(texture[lang], `texture_${texture.key}`)
    );

    const keyboard = Markup.inlineKeyboard([textureButtons]);
    const chooseTextureMsg = await msg(ctx, MESSAGES.CHOOSE_TEXTURE);
    await ctx.reply(chooseTextureMsg, keyboard);
  } catch (error) {
    console.error("handleColorSelection error:", error.message);
    await safeAnswerCbQuery(ctx, "");
    await sendErrorMessage(ctx);
  }
}

// ============================================
// TEXTURE SELECTION
// ============================================

export async function handleTextureSelection(ctx) {
  try {
    const session = await getSession(ctx.chat.id);

    if (session.state !== STATES.AWAITING_TEXTURE) {
      await safeAnswerCbQuery(ctx, "");
      return;
    }

    // Check if already processing (prevent double clicks)
    if (await isLocked(ctx.chat.id)) {
      const processingMsg = await msg(ctx, MESSAGES.ALREADY_PROCESSING);
      await safeAnswerCbQuery(ctx, processingMsg);
      return;
    }

    const textureKey = ctx.callbackQuery.data.replace("texture_", "");
    const textureDisplay = await getTextureName(ctx, textureKey);

    await updateSession(ctx.chat.id, {
      selectedTexture: textureKey,
      selectedTextureDisplay: textureDisplay,
    });

    await safeAnswerCbQuery(ctx, `✅ ${textureDisplay}`);

    // Start processing
    await startProcessing(ctx);
  } catch (error) {
    console.error("handleTextureSelection error:", error.message);
    await safeAnswerCbQuery(ctx, "");
    await sendErrorMessage(ctx);
  }
}

// ============================================
// CONFIRMATION (not used)
// ============================================

export async function handleConfirmation(ctx) {
  // Not used - kept for reference
}

// ============================================
// PROCESSING
// ============================================

async function startProcessing(ctx) {
  const chatId = ctx.chat.id;

  // Try to acquire lock (prevent duplicate processing)
  if (!(await acquireLock(chatId))) {
    // Already processing - silently ignore
    return;
  }

  try {
    const session = await getSession(chatId);

    if (await hasExceededLimit(chatId)) {
      const limitMsg = await msg(ctx, MESSAGES.LIMIT_EXCEEDED);
      await ctx.reply(limitMsg);
      return;
    }

    await updateSession(chatId, { state: STATES.PROCESSING });
    const processingMsg = await msg(ctx, MESSAGES.PROCESSING);
    await ctx.reply(processingMsg);

    const result = await processVehicleImage({
      chatId: chatId,
      vehicleImage: session.vehicleImage,
      selectedColor: session.selectedColor,
      selectedTexture: session.selectedTexture,
    });

    if (result.success && result.outputImage) {
      await incrementUsage(chatId);
      await updateSession(chatId, { state: STATES.COMPLETED });

      // Add watermark to the image
      let imageToSend;
      try {
        const watermarkedBuffer = await addWatermark(result.outputImage);
        imageToSend = { source: watermarkedBuffer };
      } catch (watermarkError) {
        console.error("Watermark error:", watermarkError.message);
        // Use original image if watermark fails
        imageToSend = result.outputImage;
      }

      const anotherColorBtn = await msg(ctx, MESSAGES.BTN_ANOTHER_COLOR);
      const callUsBtn = await msg(ctx, MESSAGES.BTN_CALL_US);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(anotherColorBtn, "result_another")],
        [Markup.button.callback(callUsBtn, "result_call")],
      ]);

      const captionMsg = await msg(ctx, MESSAGES.RESULT_CAPTION);
      await ctx.replyWithPhoto(imageToSend, {
        caption: captionMsg,
        ...keyboard,
      });

      // Show remaining generations
      const remaining = await getRemainingGenerations(chatId);
      const remainingMsg =
        session.language === LANGUAGES.AM
          ? `ℹ️ Այս շաբաթվա համար ձեզ մնացել է ${remaining} փորձ`
          : `ℹ️ На этой неделе у вас осталось ${remaining} попыток`;
      await ctx.reply(remainingMsg);
    } else {
      console.error("Processing failed - no output image");
      await sendErrorMessage(ctx);
      await resetSession(chatId);
    }
  } catch (error) {
    console.error("Processing error:", error.message);
    await sendErrorMessage(ctx);
    await resetSession(ctx.chat.id);
  } finally {
    // Always release lock
    await releaseLock(chatId);
  }
}

// ============================================
// RESULT ACTIONS
// ============================================

export async function handleResultAction(ctx) {
  try {
    const session = await getSession(ctx.chat.id);
    const action = ctx.callbackQuery.data;

    if (action === "result_another") {
      await safeAnswerCbQuery(ctx, "🎨");

      if (await hasExceededLimit(ctx.chat.id)) {
        const limitMsg = await msg(ctx, MESSAGES.LIMIT_EXCEEDED);
        await ctx.reply(limitMsg);
        return;
      }

      const language = session.language;
      await resetSession(ctx.chat.id);
      await updateSession(ctx.chat.id, {
        language,
        state: STATES.AWAITING_VEHICLE_IMAGE,
      });

      const sendVehicleMsg = await msg(ctx, MESSAGES.SEND_VEHICLE);
      await ctx.reply(sendVehicleMsg);
    } else if (action === "result_call") {
      await safeAnswerCbQuery(ctx, "📞");
      await ctx.reply(`📞 ${CONTACT_PHONE}`);
    }
  } catch (error) {
    console.error("handleResultAction error:", error.message);
    await safeAnswerCbQuery(ctx, "");
    await sendErrorMessage(ctx);
  }
}

// ============================================
// TEXT HANDLER
// ============================================

export async function handleText(ctx) {
  try {
    const session = await getSession(ctx.chat.id);

    if (session.state === STATES.IDLE || !session.language) {
      await ctx.reply("👋 Use /start to begin / Используйте /start");
    } else {
      const unexpectedMsg = await msg(ctx, MESSAGES.UNEXPECTED_TEXT);
      await ctx.reply(unexpectedMsg);
    }
  } catch (error) {
    console.error("handleText error:", error.message);
    await sendErrorMessage(ctx);
  }
}
