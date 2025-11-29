import { Markup } from "telegraf";
import { STATES, COLORS, MESSAGES } from "./constants.js";
import { getSession, updateSession, resetSession } from "./sessions.js";
import { processVehicleImage } from "./n8n.js";

// Handle /start command
export async function handleStart(ctx) {
  resetSession(ctx.chat.id);
  updateSession(ctx.chat.id, { state: STATES.AWAITING_VEHICLE_IMAGE });

  await ctx.reply(MESSAGES.WELCOME);
  await ctx.reply(MESSAGES.SEND_VEHICLE);
}

// Handle /help command
export async function handleHelp(ctx) {
  await ctx.reply(MESSAGES.HELP);
}

// Handle incoming photos
export async function handlePhoto(ctx) {
  const session = getSession(ctx.chat.id);
  const photo = ctx.message.photo;

  // Get the highest resolution photo
  const fileId = photo[photo.length - 1].file_id;

  switch (session.state) {
    case STATES.AWAITING_VEHICLE_IMAGE:
      await handleVehicleImage(ctx, fileId);
      break;

    case STATES.AWAITING_BACKGROUND_IMAGE:
      await handleBackgroundImage(ctx, fileId);
      break;

    default:
      await ctx.reply(
        "🤔 Я не ожидал изображение прямо сейчас. Используйте /start чтобы начать заново."
      );
  }
}

// Process vehicle image
async function handleVehicleImage(ctx, fileId) {
  // Get the file URL from Telegram
  const fileLink = await ctx.telegram.getFileLink(fileId);

  updateSession(ctx.chat.id, {
    state: STATES.AWAITING_COLOR,
    vehicleImage: fileLink.href,
    vehicleFileId: fileId,
  });

  // Create color selection keyboard
  const colorButtons = COLORS.map((color) =>
    Markup.button.callback(color, `color_${color.toLowerCase()}`)
  );

  // Arrange in rows of 3
  const keyboard = Markup.inlineKeyboard(
    colorButtons.reduce((rows, button, index) => {
      if (index % 3 === 0) rows.push([]);
      rows[rows.length - 1].push(button);
      return rows;
    }, [])
  );

  await ctx.reply(MESSAGES.CHOOSE_COLOR, keyboard);
}

// Handle color selection
export async function handleColorSelection(ctx) {
  const session = getSession(ctx.chat.id);

  if (session.state !== STATES.AWAITING_COLOR) {
    await ctx.answerCbQuery("Session expired. Please /start again.");
    return;
  }

  const color = ctx.callbackQuery.data.replace("color_", "");
  const colorName = color.charAt(0).toUpperCase() + color.slice(1);

  updateSession(ctx.chat.id, {
    state: STATES.AWAITING_BACKGROUND_CHOICE,
    selectedColor: colorName,
  });

  await ctx.answerCbQuery(`Вы выбрали: ${colorName}`);

  // Ask about background
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📷 Отправить фоновое изображение", "bg_send")],
    [
      Markup.button.callback(
        "⏭️ Пропустить (оставить оригинальный фон)",
        "bg_skip"
      ),
    ],
  ]);

  await ctx.reply(
    `✅ Цвет выбран: ${colorName}\n\n${MESSAGES.BACKGROUND_CHOICE}`,
    keyboard
  );
}

// Handle background choice
export async function handleBackgroundChoice(ctx) {
  const session = getSession(ctx.chat.id);
  const choice = ctx.callbackQuery.data;

  if (session.state !== STATES.AWAITING_BACKGROUND_CHOICE) {
    await ctx.answerCbQuery(
      "Сессия истекла. Пожалуйста, начните заново через /start."
    );
    return;
  }

  if (choice === "bg_skip") {
    await ctx.answerCbQuery("Фон пропущен");
    await startProcessing(ctx);
  } else if (choice === "bg_send") {
    updateSession(ctx.chat.id, { state: STATES.AWAITING_BACKGROUND_IMAGE });
    await ctx.answerCbQuery("Отправьте фоновое изображение");
    await ctx.reply(
      "📸 Пожалуйста, отправьте фоновое изображение, которое хотите использовать."
    );
  }
}

// Process background image
async function handleBackgroundImage(ctx, fileId) {
  const fileLink = await ctx.telegram.getFileLink(fileId);

  updateSession(ctx.chat.id, {
    backgroundImage: fileLink.href,
    backgroundFileId: fileId,
  });

  await startProcessing(ctx);
}

// Start the image processing
async function startProcessing(ctx) {
  const session = getSession(ctx.chat.id);

  updateSession(ctx.chat.id, { state: STATES.PROCESSING });

  await ctx.reply(MESSAGES.PROCESSING);

  try {
    // Call n8n webhook
    const result = await processVehicleImage({
      chatId: ctx.chat.id,
      vehicleImage: session.vehicleImage,
      selectedColor: session.selectedColor,
      backgroundImage: session.backgroundImage,
    });

    if (result.success && result.outputImage) {
      // Send the processed image back to user
      await ctx.replyWithPhoto(result.outputImage, {
        caption: `✅ Вот ваш автомобиль цвета ${session.selectedColor}!${
          session.backgroundImage ? " (с пользовательским фоном)" : ""
        }`,
      });
    } else {
      await ctx.reply(
        "⚠️ Обработка завершена, но изображение не было создано. Попробуйте снова."
      );
    }
  } catch (error) {
    console.error("Processing error:", error);
    await ctx.reply(MESSAGES.ERROR + "\n\nОшибка: " + error.message);
  }

  resetSession(ctx.chat.id);
}

// Handle text messages
export async function handleText(ctx) {
  const session = getSession(ctx.chat.id);
  const text = ctx.message.text.toLowerCase();

  if (session.state === STATES.AWAITING_BACKGROUND_CHOICE && text === "skip") {
    await startProcessing(ctx);
    return;
  }

  // Default response for unexpected text
  if (session.state === STATES.IDLE) {
    await ctx.reply("👋 Hi! Use /start to begin transforming your vehicle.");
  } else {
    await ctx.reply(
      "🤔 I'm expecting an image or a button selection. Need help? Use /help"
    );
  }
}
