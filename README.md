# Vehicle Color Changer Telegram Bot

A Telegram bot that uses AI to change vehicle colors and optionally swap backgrounds.

## Features

- 🚗 Change vehicle paint colors via AI
- 🖼️ Optional custom background replacement
- 🎨 10 color options to choose from
- ⚡ Fast processing via n8n + Replicate API

## Tech Stack

- **Node.js** - Runtime
- **Telegraf** - Telegram Bot Framework
- **n8n** - Workflow automation (handles AI processing)
- **Replicate API** - AI image processing (Nano Banana model)

## Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vehicle-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
BOT_TOKEN=your_telegram_bot_token
N8N_WEBHOOK_URL=https://your-instance.app.n8n.cloud/webhook/vehicle-process
```

### 3. Run Locally

```bash
npm run dev
```

### 4. Deploy to Production

```bash
npm start
```

## n8n Workflow Setup

The bot sends requests to an n8n webhook that:

1. Receives vehicle image + color + optional background
2. Calls Replicate API (Nano Banana model) for AI processing
3. Returns the processed image URL

## Environment Variables

| Variable          | Description                        |
| ----------------- | ---------------------------------- |
| `BOT_TOKEN`       | Telegram bot token from @BotFather |
| `N8N_WEBHOOK_URL` | Your n8n webhook endpoint          |

## License

MIT
