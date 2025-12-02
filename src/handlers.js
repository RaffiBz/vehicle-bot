// ============================================
// HANDLERS.JS - Conversation Flow Handlers
// Flow: Language → Photo → Color → Texture → Confirm → Process → Result
// ============================================

import { Markup } from "telegraf";
import {
  STATES,
  COLORS,
  TEXTURES,
  MESSAGES,
  LANGUAGES,
  CONTACT_PHONE,
} from "./constants.js";
import {
  getSession,
  updateSession,
  resetSession,
  hasExceededLimit,
  incrementUsage,
  getRemainingGenerations,
  getLocalizedMessage,
} from "./sessions.js";
import { processVehicleImage } from "./n8n.js";
import { addWatermark } from "./watermark.js";

// ============================================
// HELPERS
// ============================================

function msg(ctx, messageObj) {
  return getLocalizedMessage(ctx.chat.id, messageObj);
}

function getColorName(ctx, colorKey) {
  const session = getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;
  const color = COLORS.find((c) => c.key === colorKey);
  return color ? color[lang] : colorKey;
}

function getTextureName(ctx, textureKey) {
  const session = getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;
  const texture = TEXTURES.find((t) => t.key === textureKey);
  return texture ? texture[lang] : textureKey;
}

// ============================================
// /start COMMAND
// ============================================

export async function handleStart(ctx) {
  resetSession(ctx.chat.id);
  updateSession(ctx.chat.id, { state: STATES.AWAITING_LANGUAGE });

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(MESSAGES.BTN_LANG_RU, "lang_ru"),
      Markup.button.callback(MESSAGES.BTN_LANG_AM, "lang_am"),
    ],
  ]);

  await ctx.reply(MESSAGES.WELCOME, keyboard);
}

// ============================================
// /help COMMAND
// ============================================

export async function handleHelp(ctx) {
  await ctx.reply(msg(ctx, MESSAGES.HELP));
}

// ============================================
// LANGUAGE SELECTION
// ============================================

export async function handleLanguageSelection(ctx) {
  const session = getSession(ctx.chat.id);

  if (session.state !== STATES.AWAITING_LANGUAGE) {
    await ctx.answerCbQuery(msg(ctx, MESSAGES.SESSION_EXPIRED));
    return;
  }

  const language = ctx.callbackQuery.data.replace("lang_", "");

  if (language !== LANGUAGES.RU && language !== LANGUAGES.AM) {
    await ctx.answerCbQuery("Invalid language");
    return;
  }

  // Check limit before continuing
  if (hasExceededLimit(ctx.chat.id)) {
    updateSession(ctx.chat.id, { language });
    await ctx.answerCbQuery("⚠️");
    await ctx.reply(msg(ctx, MESSAGES.LIMIT_EXCEEDED));
    return;
  }

  updateSession(ctx.chat.id, {
    language,
    state: STATES.AWAITING_VEHICLE_IMAGE,
  });

  const langName = language === LANGUAGES.RU ? "Русский" : "Armenian";
  await ctx.answerCbQuery(`✅ ${langName}`);
  await ctx.reply(msg(ctx, MESSAGES.SEND_VEHICLE));
}

// ============================================
// PHOTO HANDLER
// ============================================

export async function handlePhoto(ctx) {
  const session = getSession(ctx.chat.id);
  const photo = ctx.message.photo;
  const fileId = photo[photo.length - 1].file_id;

  if (session.state === STATES.AWAITING_VEHICLE_IMAGE) {
    await handleVehicleImage(ctx, fileId);
  } else {
    await ctx.reply(msg(ctx, MESSAGES.UNEXPECTED_IMAGE));
  }
}

async function handleVehicleImage(ctx, fileId) {
  if (hasExceededLimit(ctx.chat.id)) {
    await ctx.reply(msg(ctx, MESSAGES.LIMIT_EXCEEDED));
    return;
  }

  const fileLink = await ctx.telegram.getFileLink(fileId);
  const session = getSession(ctx.chat.id);
  const lang = session.language || LANGUAGES.RU;

  updateSession(ctx.chat.id, {
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

  await ctx.reply(msg(ctx, MESSAGES.CHOOSE_COLOR), keyboard);
}

// ============================================
// COLOR SELECTION
// ============================================

export async function handleColorSelection(ctx) {
  const session = getSession(ctx.chat.id);

  if (session.state !== STATES.AWAITING_COLOR) {
    await ctx.answerCbQuery(msg(ctx, MESSAGES.SESSION_EXPIRED));
    return;
  }

  const colorKey = ctx.callbackQuery.data.replace("color_", "");
  const colorDisplay = getColorName(ctx, colorKey);

  updateSession(ctx.chat.id, {
    state: STATES.AWAITING_TEXTURE,
    selectedColor: colorKey,
    selectedColorDisplay: colorDisplay,
  });

  await ctx.answerCbQuery(`✅ ${colorDisplay}`);

  // Texture buttons
  const lang = session.language || LANGUAGES.RU;
  const textureButtons = TEXTURES.map((texture) =>
    Markup.button.callback(texture[lang], `texture_${texture.key}`)
  );

  const keyboard = Markup.inlineKeyboard([textureButtons]);
  await ctx.reply(msg(ctx, MESSAGES.CHOOSE_TEXTURE), keyboard);
}

// ============================================
// TEXTURE SELECTION
// ============================================

export async function handleTextureSelection(ctx) {
  const session = getSession(ctx.chat.id);

  if (session.state !== STATES.AWAITING_TEXTURE) {
    await ctx.answerCbQuery(msg(ctx, MESSAGES.SESSION_EXPIRED));
    return;
  }

  const textureKey = ctx.callbackQuery.data.replace("texture_", "");
  const textureDisplay = getTextureName(ctx, textureKey);

  updateSession(ctx.chat.id, {
    selectedTexture: textureKey,
    selectedTextureDisplay: textureDisplay,
  });

  await ctx.answerCbQuery(`✅ ${textureDisplay}`);

  await startProcessing(ctx);
}

// ============================================
// PROCESSING
// ============================================

async function startProcessing(ctx) {
  const session = getSession(ctx.chat.id);

  if (hasExceededLimit(ctx.chat.id)) {
    await ctx.reply(msg(ctx, MESSAGES.LIMIT_EXCEEDED));
    return;
  }

  updateSession(ctx.chat.id, { state: STATES.PROCESSING });
  await ctx.reply(msg(ctx, MESSAGES.PROCESSING));

  try {
    const result = await processVehicleImage({
      chatId: ctx.chat.id,
      vehicleImage: session.vehicleImage,
      selectedColor: session.selectedColor,
      selectedTexture: session.selectedTexture,
    });

    if (result.success && result.outputImage) {
      incrementUsage(ctx.chat.id);
      updateSession(ctx.chat.id, { state: STATES.COMPLETED });

      // Add watermark to the image
      let imageToSend;
      try {
        const watermarkedBuffer = await addWatermark(result.outputImage);
        imageToSend = { source: watermarkedBuffer };
      } catch (watermarkError) {
        console.error(
          "Watermark error, using original:",
          watermarkError.message
        );
        imageToSend = result.outputImage; // Fallback to original if watermark fails
      }

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            msg(ctx, MESSAGES.BTN_ANOTHER_COLOR),
            "result_another"
          ),
        ],
        [Markup.button.callback(msg(ctx, MESSAGES.BTN_CALL_US), "result_call")],
      ]);

      await ctx.replyWithPhoto(imageToSend, {
        caption: msg(ctx, MESSAGES.RESULT_CAPTION),
        ...keyboard,
      });

      // Warn if running low on generations
      const remaining = getRemainingGenerations(ctx.chat.id);
      if (remaining <= 3 && remaining > 0) {
        const warning =
          session.language === LANGUAGES.AM
            ? `ℹ️ Այսօր մնացածը՝ ${remaining}`
            : `ℹ️ Осталось сегодня: ${remaining}`;
        await ctx.reply(warning);
      }
    } else {
      await ctx.reply(msg(ctx, MESSAGES.ERROR));
      resetSession(ctx.chat.id);
    }
  } catch (error) {
    console.error("Processing error:", error);
    await ctx.reply(msg(ctx, MESSAGES.ERROR) + "\n\n" + error.message);
    resetSession(ctx.chat.id);
  }
}

// ============================================
// RESULT ACTIONS
// ============================================

export async function handleResultAction(ctx) {
  const session = getSession(ctx.chat.id);
  const action = ctx.callbackQuery.data;

  if (action === "result_another") {
    await ctx.answerCbQuery("🎨");

    if (hasExceededLimit(ctx.chat.id)) {
      await ctx.reply(msg(ctx, MESSAGES.LIMIT_EXCEEDED));
      return;
    }

    const language = session.language;
    resetSession(ctx.chat.id);
    updateSession(ctx.chat.id, {
      language,
      state: STATES.AWAITING_VEHICLE_IMAGE,
    });

    await ctx.reply(msg(ctx, MESSAGES.SEND_VEHICLE));
  } else if (action === "result_call") {
    await ctx.answerCbQuery("📞");
    await ctx.reply(`📞 ${CONTACT_PHONE}`);
  }
}

// ============================================
// TEXT HANDLER
// ============================================

export async function handleText(ctx) {
  const session = getSession(ctx.chat.id);

  if (session.state === STATES.IDLE || !session.language) {
    await ctx.reply("👋 Use /start to begin / Используйте /start");
  } else {
    await ctx.reply(msg(ctx, MESSAGES.UNEXPECTED_TEXT));
  }
}
