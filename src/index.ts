import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { KlingAPI } from './kling-api.js';
import { PromptEnhancer } from './prompt-enhancer.js';
import { BudgetTracker } from './budget-tracker.js';
import { appendLog, formatCurrency, detectAspectRatio } from './utils.js';
import type { AppConfig, UserSettings, KlingDuration, KlingMode, KlingAspectRatio, AspectRatioSetting } from './types/index.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Configuration ---

function loadConfig(): AppConfig {
  const configFile = path.join(__dirname, '../config.json');
  if (fs.existsSync(configFile)) {
    console.warn('⚠️  Using config.json (deprecated). Please migrate to .env file.');
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf8')) as AppConfig;
    return raw;
  }

  const allowedUserIds = process.env['ALLOWED_USER_IDS']
    ? process.env['ALLOWED_USER_IDS'].split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
    : [];

  const config: AppConfig = {
    telegramBotToken: process.env['TELEGRAM_BOT_TOKEN'] ?? '',
    klingAccessKey: process.env['KLING_ACCESS_KEY'] ?? '',
    klingSecretKey: process.env['KLING_SECRET_KEY'] ?? '',
    allowedUserIds,
    dailyBudgetUsd: parseFloat(process.env['DAILY_BUDGET_USD'] ?? '5'),
    defaultModel: (process.env['DEFAULT_MODEL'] as AppConfig['defaultModel']) || 'kling-v2-6',
    defaultMode: (process.env['DEFAULT_MODE'] as KlingMode) || 'pro',
    defaultDuration: (parseInt(process.env['DEFAULT_DURATION'] ?? '5', 10) as KlingDuration) || 5,
    defaultAspectRatio: (process.env['DEFAULT_ASPECT_RATIO'] as AspectRatioSetting) || 'auto',
  };

  if (!config.telegramBotToken || !config.klingAccessKey || !config.klingSecretKey) {
    console.error('❌ Missing required environment variables!');
    console.error('Please copy .env.example to .env and fill in your API keys.');
    console.error('\nRequired variables:');
    console.error('  - TELEGRAM_BOT_TOKEN');
    console.error('  - KLING_ACCESS_KEY');
    console.error('  - KLING_SECRET_KEY');
    process.exit(1);
  }

  return config;
}

const config = loadConfig();

// --- User settings ---

const userSettingsMap = new Map<number, UserSettings>();

function getUserSettings(userId: number): UserSettings {
  let settings = userSettingsMap.get(userId);
  if (!settings) {
    settings = {
      duration: config.defaultDuration,
      aspectRatio: config.defaultAspectRatio,
      mode: config.defaultMode,
      sound: true,
    };
    userSettingsMap.set(userId, settings);
  }
  return settings;
}

// --- Services ---

const bot = new TelegramBot(config.telegramBotToken, { polling: true });
const klingAPI = new KlingAPI(config.klingAccessKey, config.klingSecretKey);
const promptEnhancer = new PromptEnhancer();
const budgetTracker = new BudgetTracker(config.dailyBudgetUsd);

const LOG_FILE = path.join(__dirname, '../data/generations.log');

// --- Helpers ---

function isAllowed(userId: number): boolean {
  if (!config.allowedUserIds || config.allowedUserIds.length === 0) return true;
  return config.allowedUserIds.includes(userId);
}

function logGeneration(
  userId: number,
  prompt: string,
  enhancedPrompt: string,
  cost: number,
  status: 'success' | 'failed'
): void {
  const logEntry = JSON.stringify({ timestamp: new Date().toISOString(), userId, prompt, enhancedPrompt, cost, status });
  appendLog(LOG_FILE, logEntry);
}

// --- Commands ---

bot.onText(/\/start/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Sorry, you are not authorized to use this bot.');
    return;
  }

  const welcome =
    `🎬 *Kling AI Video Generator*\n\n` +
    `Welcome! I can generate stunning AI videos from your text prompts or images.\n\n` +
    `*Commands:*\n` +
    `/help - Show all commands\n` +
    `/budget - Check today's spending\n` +
    `/settings - View current settings\n` +
    `/duration 5|10 - Set video duration\n` +
    `/aspect 16:9|9:16|1:1|auto - Set aspect ratio (auto = match image)\n` +
    `/mode std|pro - Set quality mode\n` +
    `/sound - Toggle sound generation 🔊/🔇\n` +
    `/enhance - Toggle AI prompt enhancement\n\n` +
    `*Usage:*\n` +
    `📝 Send text → Text-to-video\n` +
    `🖼️ Send photo with caption → Image-to-video\n\n` +
    `Let's create something amazing! 🚀`;

  bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const help =
    `🎬 *Kling AI Video Generator - Help*\n\n` +
    `*Commands:*\n` +
    `/start - Welcome message\n` +
    `/help - This help message\n` +
    `/budget - Show daily budget status\n` +
    `/settings - Show your current settings\n` +
    `/duration 5|10 - Set default duration (seconds)\n` +
    `/aspect 16:9|9:16|1:1|auto - Set aspect ratio (auto = match image)\n` +
    `/mode std|pro - Set quality mode\n` +
    `/sound - Toggle sound generation 🔊/🔇\n` +
    `/enhance - Toggle AI prompt enhancement (Claude)\n\n` +
    `*Video Generation:*\n` +
    `📝 *Text-to-Video:* Just send any text message\n` +
    `   Example: "dog running on beach"\n\n` +
    `🖼️ *Image-to-Video:* Send a photo with a caption\n` +
    `   The caption describes what should happen\n\n` +
    `*Tips:*\n` +
    `• Prompts are enhanced by Claude AI for cinematic quality\n` +
    `• Use /enhance to toggle enhancement on/off\n` +
    `• Pro mode (default) gives best quality\n` +
    `• 5s videos cost $0.33, 10s cost $0.66\n` +
    `• Daily budget: $${config.dailyBudgetUsd}\n\n` +
    `Questions? Just ask! 💬`;

  bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
});

bot.onText(/\/budget/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }
  bot.sendMessage(msg.chat.id, budgetTracker.formatStatus(), { parse_mode: 'Markdown' });
});

bot.onText(/\/settings/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const settings = getUserSettings(userId);
  const text =
    `⚙️ *Your Settings*\n\n` +
    `Duration: ${settings.duration}s\n` +
    `Aspect Ratio: ${settings.aspectRatio}\n` +
    `Mode: ${settings.mode}\n` +
    `Model: ${config.defaultModel}\n` +
    `Sound: ${settings.sound ? '🔊 ON' : '🔇 OFF'}\n` +
    `Prompt Enhancement: ${promptEnhancer.isEnabled() ? '✨ ON' : '🔕 OFF'}\n\n` +
    `*Cost per video:* ${formatCurrency(KlingAPI.calculateCost(config.defaultModel, settings.mode, settings.duration))}`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/duration (.+)/, (msg, match) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const duration = parseInt(match?.[1] ?? '', 10);
  if (duration !== 5 && duration !== 10) {
    bot.sendMessage(msg.chat.id, '❌ Duration must be 5 or 10 seconds.');
    return;
  }

  const settings = getUserSettings(userId);
  settings.duration = duration;
  bot.sendMessage(msg.chat.id, `✅ Default duration set to ${duration}s`);
});

bot.onText(/\/aspect (.+)/, (msg, match) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const ratio = match?.[1]?.trim() ?? '';
  const validRatios: AspectRatioSetting[] = ['16:9', '9:16', '1:1', 'auto'];
  if (!validRatios.includes(ratio as AspectRatioSetting)) {
    bot.sendMessage(msg.chat.id, '❌ Aspect ratio must be 16:9, 9:16, 1:1, or auto');
    return;
  }

  const settings = getUserSettings(userId);
  settings.aspectRatio = ratio as AspectRatioSetting;
  const label = ratio === 'auto' ? 'auto (matches image)' : ratio;
  bot.sendMessage(msg.chat.id, `✅ Default aspect ratio set to ${label}`);
});

bot.onText(/\/mode (.+)/, (msg, match) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const mode = match?.[1]?.toLowerCase() ?? '';
  if (mode !== 'std' && mode !== 'pro') {
    bot.sendMessage(msg.chat.id, '❌ Mode must be "std" or "pro"');
    return;
  }

  const settings = getUserSettings(userId);
  settings.mode = mode;
  bot.sendMessage(msg.chat.id, `✅ Default mode set to ${mode}`);
});

bot.onText(/\/sound/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  const settings = getUserSettings(userId);
  settings.sound = !settings.sound;
  bot.sendMessage(msg.chat.id, `${settings.sound ? '🔊' : '🔇'} Sound generation: ${settings.sound ? 'ON' : 'OFF'}`);
});

bot.onText(/\/enhance/, (msg) => {
  const userId = msg.from?.id;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(msg.chat.id, '❌ Not authorized.');
    return;
  }

  if (!promptEnhancer.isAvailable()) {
    bot.sendMessage(
      msg.chat.id,
      '❌ Enhancement not available — no API key or CLI configured.\n\n' +
        'To enable enhancement, set either:\n' +
        '• ANTHROPIC_API_KEY in .env, or\n' +
        '• CLAUDE_CLI_PATH to your Claude CLI binary'
    );
    return;
  }

  const newState = !promptEnhancer.isEnabled();
  promptEnhancer.setEnabled(newState);
  bot.sendMessage(msg.chat.id, `${newState ? '✨' : '🔕'} AI prompt enhancement: ${newState ? 'ON' : 'OFF'}`);
});

// --- Photo handler (image-to-video) ---

bot.on('photo', async (msg) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;

  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(chatId, '❌ Not authorized.');
    return;
  }

  const caption = msg.caption;
  if (!caption?.trim()) {
    bot.sendMessage(chatId, '📝 Please send the photo again with a caption describing what should happen in the video.');
    return;
  }

  const photo = msg.photo?.[msg.photo.length - 1];
  if (!photo) {
    bot.sendMessage(chatId, '❌ Could not process the photo.');
    return;
  }

  try {
    // Auto-detect aspect ratio from image dimensions
    const settings = getUserSettings(userId);
    let arOverride: KlingAspectRatio | undefined;
    if (settings.aspectRatio === 'auto' && photo.width && photo.height) {
      arOverride = detectAspectRatio(photo.width, photo.height);
      bot.sendMessage(chatId, `📐 Auto-detected aspect ratio: ${arOverride} (from ${photo.width}×${photo.height})`);
    }

    const fileLink = await bot.getFileLink(photo.file_id);
    const response = await axios.get<ArrayBuffer>(fileLink, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data).toString('base64');
    await generateVideo(chatId, userId, caption, base64Image, arOverride);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error handling photo:', error);
    bot.sendMessage(chatId, '❌ Error processing photo: ' + message);
  }
});

// --- Text handler (text-to-video) ---

bot.on('message', async (msg) => {
  const userId = msg.from?.id;
  const chatId = msg.chat.id;

  if (msg.text?.startsWith('/')) return;
  if (msg.photo) return;
  if (!msg.text) return;
  if (!userId || !isAllowed(userId)) {
    bot.sendMessage(chatId, '❌ Not authorized.');
    return;
  }

  const prompt = msg.text.trim();
  if (!prompt) return;

  await generateVideo(chatId, userId, prompt, null);
});

// --- Main generation function ---

async function generateVideo(
  chatId: number,
  userId: number,
  userPrompt: string,
  imageBase64: string | null,
  overrideAspectRatio?: KlingAspectRatio
): Promise<void> {
  const settings = getUserSettings(userId);
  const effectiveAspectRatio: KlingAspectRatio = overrideAspectRatio
    ?? (settings.aspectRatio === 'auto' ? '16:9' : settings.aspectRatio);
  const cost = KlingAPI.calculateCost(config.defaultModel, settings.mode, settings.duration);

  if (!budgetTracker.canAfford(cost)) {
    bot.sendMessage(
      chatId,
      `❌ Daily budget exceeded!\n\n` +
        `This video costs ${formatCurrency(cost)}\n` +
        `Remaining today: ${formatCurrency(budgetTracker.getRemaining())}\n\n` +
        `Budget resets at midnight UTC.`
    );
    return;
  }

  const isI2V = !!imageBase64;

  let enhancingMsg: TelegramBot.Message | null = null;
  if (promptEnhancer.isEnabled()) {
    enhancingMsg = await bot.sendMessage(chatId, '✨ Enhancing prompt with AI...');
  }

  let enhancedPrompt = userPrompt;
  try {
    enhancedPrompt = await promptEnhancer.enhance(userPrompt, isI2V);
  } catch {
    enhancedPrompt = userPrompt;
  }

  const wasEnhanced = promptEnhancer.isEnabled() && enhancedPrompt !== userPrompt;

  if (enhancingMsg) {
    await bot.deleteMessage(chatId, enhancingMsg.message_id).catch(() => {});
  }

  console.log(`Original prompt: "${userPrompt}"`);
  console.log(`Enhanced prompt: "${enhancedPrompt}"`);

  if (wasEnhanced) {
    await bot.sendMessage(chatId, `✨ *Enhanced prompt:*\n\n${enhancedPrompt}`, { parse_mode: 'Markdown' });
  }

  const statusMsg = await bot.sendMessage(
    chatId,
    `🎬 Generating ${isI2V ? 'image-to-video' : 'text-to-video'}...\n\n` +
      `⚙️ ${settings.mode} mode | ${settings.duration}s | ${effectiveAspectRatio} | ${settings.sound ? '🔊' : '🔇'}\n` +
      `💰 Cost: ${formatCurrency(cost)}\n\n` +
      `⏳ This may take 1-3 minutes...`
  );

  try {
    const genOptions = {
      model: config.defaultModel,
      mode: settings.mode,
      duration: settings.duration,
      aspectRatio: effectiveAspectRatio,
      sound: settings.sound,
    };

    const taskResponse = imageBase64
      ? await klingAPI.createImageToVideo(imageBase64, enhancedPrompt, genOptions)
      : await klingAPI.createTextToVideo(enhancedPrompt, genOptions);

    const taskId = taskResponse.data?.task_id ?? taskResponse.task_id;
    const taskType = imageBase64 ? 'image2video' as const : 'text2video' as const;

    if (!taskId) throw new Error('No task ID received from API');

    console.log(`Task created: ${taskId} (${taskType})`);

    let lastStatus = '';
    const result = await klingAPI.pollTask(taskId, taskType, (status) => {
      const currentStatus = status.data?.task_status ?? status.task_status ?? status.status ?? 'processing';
      if (currentStatus !== lastStatus) {
        console.log(`Task ${taskId} status: ${currentStatus}`);
        lastStatus = currentStatus;
      }
    });

    const videoUrl =
      result.task_result?.videos?.[0]?.url ?? result.data?.task_result?.videos?.[0]?.url;

    if (!videoUrl) throw new Error('No video URL in response');

    budgetTracker.addExpense(cost, {
      userId,
      prompt: userPrompt,
      enhancedPrompt,
      duration: settings.duration,
      mode: settings.mode,
    });

    logGeneration(userId, userPrompt, enhancedPrompt, cost, 'success');

    await bot.editMessageText(
      `✅ *Video generated!*\n\nPrompt: "${userPrompt}"\nCost: ${formatCurrency(cost)}\n\nDownloading...`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' }
    );

    const tmpPath = `/tmp/kling-${taskId}.mp4`;
    const videoResponse = await axios.get<ArrayBuffer>(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
    fs.writeFileSync(tmpPath, Buffer.from(videoResponse.data));

    await bot.sendVideo(chatId, tmpPath, {
      caption: `🎬 "${userPrompt}"\n\n⚙️ ${settings.mode} • ${settings.duration}s • ${effectiveAspectRatio}`,
    });

    fs.unlinkSync(tmpPath);
    await bot.deleteMessage(chatId, statusMsg.message_id);

    const remaining = budgetTracker.getRemaining();
    bot.sendMessage(chatId, `💰 Remaining today: ${formatCurrency(remaining)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error generating video:', error);
    logGeneration(userId, userPrompt, enhancedPrompt, 0, 'failed');

    await bot.editMessageText(
      `❌ Video generation failed\n\nError: ${message}\n\nYour budget was not charged.`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    );
  }
}

// --- Graceful shutdown ---

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Kling AI Video Bot is running...');
if (config.allowedUserIds.length > 0) {
  console.log(`Allowed users: ${config.allowedUserIds.join(', ')}`);
} else {
  console.log('Allowed users: Anyone (no whitelist)');
}
console.log(`Daily budget: $${config.dailyBudgetUsd}`);
