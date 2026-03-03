# 🎬 Kling AI Video Bot for Telegram

A powerful Telegram bot that generates stunning AI videos using Kling AI's state-of-the-art video generation models. Create cinematic videos from text prompts or animate images with natural motion — all from within Telegram.

## ✨ Features

- 🎥 **Text-to-Video** — Generate videos from descriptive text prompts
- 🖼️ **Image-to-Video** — Animate your photos with natural motion
- 🔊 **Native Sound Generation** — Videos include synchronized audio
- 🧠 **AI Prompt Enhancement** — Optional Claude AI integration for cinematic prompt optimization
- 💰 **Budget Tracking** — Daily spending limits with automatic reset
- 👥 **User Whitelist** — Optional access control for private deployments
- ⚙️ **Flexible Settings** — Customize duration, aspect ratio, quality mode per user
- 🐳 **Docker Support** — Deploy in seconds with Docker Compose

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/progresak/clipforge.git
   cd kling-telegram-bot
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env  # Fill in your API keys
   ```

3. **Start the bot**
   ```bash
   docker compose up -d
   ```

That's it! Your bot is now running.

### Option 2: Manual Installation

**Requirements:** Node.js 18+, ffmpeg

1. **Clone and install**
   ```bash
   git clone https://github.com/progresak/clipforge.git
   cd kling-telegram-bot
   npm install
   ```

2. **Configure**
   ```bash
   cp .env.example .env
   nano .env  # Fill in your API keys
   ```

3. **Build & Run**
   ```bash
   npm run build
   npm start
   ```

## 🔑 Getting Your API Keys

### Telegram Bot Token (Required)

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Paste it into `.env` as `TELEGRAM_BOT_TOKEN`

### Kling AI API Keys (Required)

1. Visit [Kling AI Developer Portal](https://klingai.com/global/dev/model/video)
2. Sign up or log in to your account
3. Navigate to API keys section
4. Generate new API keys (Access Key + Secret Key)
5. Add them to `.env`:
   - `KLING_ACCESS_KEY`
   - `KLING_SECRET_KEY`

**Pricing:** Kling AI charges per video generation:
- 5-second video (Pro mode): $0.33
- 10-second video (Pro mode): $0.66

### Anthropic API Key (Optional)

For AI-powered prompt enhancement:

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Generate an API key
4. Add to `.env` as `ANTHROPIC_API_KEY`

*Note: Prompt enhancement is entirely optional. The bot works perfectly without it.*

## ⚙️ Configuration

Edit `.env` to customize your bot:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | - | Your Telegram bot token from @BotFather |
| `KLING_ACCESS_KEY` | ✅ Yes | - | Kling AI API access key |
| `KLING_SECRET_KEY` | ✅ Yes | - | Kling AI API secret key |
| `ALLOWED_USER_IDS` | ❌ No | (empty) | Comma-separated Telegram user IDs. Empty = anyone can use |
| `DAILY_BUDGET_USD` | ❌ No | `5` | Maximum spending per day (resets at midnight UTC) |
| `DEFAULT_MODEL` | ❌ No | `kling-v2-6` | Kling AI model version |
| `DEFAULT_MODE` | ❌ No | `pro` | Generation quality: `std` or `pro` |
| `DEFAULT_DURATION` | ❌ No | `5` | Video length in seconds: `5` or `10` |
| `DEFAULT_ASPECT_RATIO` | ❌ No | `16:9` | Options: `16:9`, `9:16`, `1:1` |
| `ANTHROPIC_API_KEY` | ❌ No | - | For AI prompt enhancement (optional) |
| `CLAUDE_CLI_PATH` | ❌ No | - | Path to Claude CLI (alternative to API) |

### User Whitelist

To restrict bot access to specific users:

1. Get your Telegram user ID (send any message to [@userinfobot](https://t.me/userinfobot))
2. Add to `.env`: `ALLOWED_USER_IDS=123456789,987654321`
3. Leave empty to allow anyone

## 🤖 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and feature overview |
| `/help` | Detailed help and usage instructions |
| `/budget` | Check today's spending and remaining budget |
| `/settings` | View your current generation settings |
| `/duration 5\|10` | Set default video duration (seconds) |
| `/aspect 16:9\|9:16\|1:1` | Set aspect ratio |
| `/mode std\|pro` | Set quality mode |
| `/sound` | Toggle sound generation on/off 🔊/🔇 |
| `/enhance` | Toggle AI prompt enhancement on/off ✨ |

## 📖 Usage

### Text-to-Video

Simply send any text message to the bot:

```
A majestic dragon soaring through storm clouds at sunset
```

The bot will:
1. ✨ Enhance your prompt (if enabled)
2. 🎬 Generate the video using Kling AI
3. 📹 Send you the finished video

### Image-to-Video

1. Send a photo to the bot
2. Add a caption describing the desired motion:
   ```
   Camera slowly zooms in while waves crash on the shore
   ```
3. The bot will animate your image

## 🧠 AI Prompt Enhancement

The optional Claude AI integration transforms simple prompts into cinematic masterpieces:

**Your input:**
```
dog running on beach
```

**Enhanced prompt:**
```
Golden retriever ++sprinting across wet sand++ at golden hour, ocean waves 
crashing in background. Camera: dynamic tracking shot following lateral 
motion, shallow depth of field (f/2.8). Volumetric lighting through ocean 
spray, warm color grading, shot on ARRI Alexa. SFX: paws splashing through 
water, distant seagulls, crashing waves. Cinematic realism, film grain.
```

**How to enable:**
1. Add `ANTHROPIC_API_KEY` to your `.env` file
2. The bot automatically uses Claude Sonnet 4.5 for enhancement
3. Toggle on/off anytime with `/enhance`

**Cost:** ~$0.01 per enhancement (negligible compared to video generation)

## 🏗️ Architecture

The project is written in **TypeScript** with strict type-checking enabled.

```
src/
├── index.ts              # Main bot logic & command handlers
├── kling-api.ts          # Kling AI API client & JWT auth
├── prompt-enhancer.ts    # Claude AI integration (API + CLI)
├── budget-tracker.ts     # Daily spending tracker
├── utils.ts              # Helper functions
└── types/
    ├── index.ts          # Type re-exports
    ├── kling.ts          # Kling AI API types
    └── config.ts         # App config & settings types

prompts/
└── enhance-video.txt     # System prompt for Claude enhancement

data/
├── budget.json           # Daily budget state (auto-generated)
└── generations.log       # Generation history (auto-generated)
```

## 🐳 Docker Deployment

The provided `docker-compose.yml` handles everything:

- ✅ Node.js 20 runtime
- ✅ ffmpeg for video processing
- ✅ Automatic restarts
- ✅ Data persistence in `./data/`
- ✅ Non-root user for security

**Useful commands:**

```bash
# Start bot
docker compose up -d

# View logs
docker compose logs -f

# Restart bot
docker compose restart

# Stop bot
docker compose down
```

## 💡 Tips

- **Pro mode** (default) generates higher quality videos but costs 2x more than Standard mode
- **Prompt enhancement** significantly improves video quality — try it!
- **Budget tracking** resets daily at midnight UTC to prevent overspending
- **5-second videos** are perfect for quick tests and cost less
- Use descriptive prompts with camera movements for best results

## 🛠️ Troubleshooting

**Bot doesn't respond:**
- Check logs: `docker compose logs -f` or `npm start`
- Verify `.env` variables are set correctly
- Ensure your Telegram user ID is in `ALLOWED_USER_IDS` (if using whitelist)

**"Enhancement not available" error:**
- Make sure `ANTHROPIC_API_KEY` is set in `.env`
- Or install Claude CLI and set `CLAUDE_CLI_PATH`
- Enhancement is optional — bot works without it

**Video generation fails:**
- Check Kling AI API key validity
- Verify you have sufficient Kling API credits
- Check daily budget hasn't been exceeded (`/budget`)

**Docker build fails:**
- Ensure Docker and Docker Compose are installed
- Try `docker compose build --no-cache`

## 📊 Budget Management

The bot tracks daily spending automatically:

- Expenses are logged in `data/budget.json`
- Budget resets at midnight UTC
- Check anytime with `/budget`
- Videos are never generated if budget is exceeded

## 🤝 Contributing

Contributions welcome! Feel free to:

- 🐛 Report bugs via [GitHub Issues](https://github.com/progresak/clipforge/issues)
- 💡 Suggest features
- 🔧 Submit pull requests
- ⭐ Star the repo if you find it useful!

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Kling AI](https://klingai.com/) for their amazing video generation API
- [Anthropic](https://anthropic.com/) for Claude AI prompt enhancement
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) for Telegram integration

---

**Made with ❤️ by [progresak](https://github.com/progresak)**

*Generate stunning AI videos right from your Telegram chat!*
