export const STATES = {
  IDLE: "IDLE",
  AWAITING_VEHICLE_IMAGE: "AWAITING_VEHICLE_IMAGE",
  AWAITING_COLOR: "AWAITING_COLOR",
  AWAITING_BACKGROUND_CHOICE: "AWAITING_BACKGROUND_CHOICE",
  AWAITING_BACKGROUND_IMAGE: "AWAITING_BACKGROUND_IMAGE",
  PROCESSING: "PROCESSING",
};

export const COLORS = [
  "Red",
  "Blue",
  "Black",
  "White",
  "Silver",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
];

export const MESSAGES = {
  WELCOME: `🚗 Welcome to Vehicle Color Changer Bot!

Send me a photo of a vehicle and I'll help you:
- Change its color
- Optionally place it on a new background

Use /start to begin or /help for instructions.`,

  SEND_VEHICLE:
    "📸 Please send me a clear photo of the vehicle you want to modify.",

  CHOOSE_COLOR: "🎨 Great photo! Now choose a color for your vehicle:",

  BACKGROUND_CHOICE: `🖼️ Would you like to add a custom background?

- Send me a background image, OR
- Type "skip" to keep the original background`,

  PROCESSING: "⏳ Processing your image... This may take 30-60 seconds.",

  ERROR: "❌ Something went wrong. Please try again with /start",

  INVALID_IMAGE: "⚠️ Please send a valid photo. Make sure it's an image file.",

  HELP: `🔧 How to use this bot:

1. Send /start to begin
2. Upload a clear photo of a vehicle
3. Select your desired color
4. Optionally add a custom background
5. Wait for the magic! ✨

Tips:
- Use clear, well-lit photos
- Side or front angles work best
- Higher resolution = better results`,
};
