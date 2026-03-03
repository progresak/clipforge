const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const KlingAPI = require('./kling-api');
const PromptEnhancer = require('./prompt-enhancer');
const BudgetTracker = require('./budget-tracker');
const { appendLog, formatCurrency } = require('./utils');

// Load environment variables
require('dotenv').config();

// Load configuration from environment variables (with config.json fallback for backward compatibility)
let config;

const CONFIG_FILE = path.join(__dirname, '../config.json');
if (fs.existsSync(CONFIG_FILE)) {
  console.warn('⚠️  Using config.json (deprecated). Please migrate to .env file.');
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} else {
  // Parse allowed user IDs from comma-separated string
  const allowedUserIds = process.env.ALLOWED_USER_IDS
    ? process.env.ALLOWED_USER_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    : [];

  config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    klingAccessKey: process.env.KLING_ACCESS_KEY,
    klingSecretKey: process.env.KLING_SECRET_KEY,
    allowedUserIds: allowedUserIds,
    dailyBudgetUsd: parseFloat(process.env.DAILY_BUDGET_USD || '5'),
    defaultModel: process.env.DEFAULT_MODEL || 'kling-v2-6',
    defaultMode: process.env.DEFAULT_MODE || 'pro',
    defaultDuration: parseInt(process.env.DEFAULT_DURATION || '5'),
    defaultAspectRatio: process.env.DEFAULT_ASPECT_RATIO || '16:9'
  };

  // Validate required fields
  if (!config.telegramBotToken || !config.klingAccessKey || !config.klingSecretKey) {
    console.error('❌ Missing required environment variables!');
    console.error('Please copy .env.example to .env and fill in your API keys.');
    console.error('\nRequired variables:');
    console.error('  - TELEGRAM_BOT_TOKEN');
    console.error('  - KLING_ACCESS_KEY');
    console.error('  - KLING_SECRET_KEY');
    process.exit(1);
  }
}

// User settings (per-user preferences)
const userSettings = {};

// Initialize services
const bot = new TelegramBot(config.telegramBotToken, { polling: true });
const klingAPI = new KlingAPI(config.klingAccessKey, config.klingSecretKey);
const promptEnhancer = new PromptEnhancer();
const budgetTracker = new BudgetTracker(config.dailyBudgetUsd);

const LOG_FILE = path.join(__dirname, '../data/generations.log');

// Middleware: Check if user is allowed
function isAllowed(userId) {
  // If no user IDs specified, allow everyone
  if (!config.allowedUserIds || config.allowedUserIds.length === 0) {
    return true;
  }
  return config.allowedUserIds.includes(userId);
}

// Get user settings with defaults
function getUserSettings(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = {
      duration: config.defaultDuration,
      aspectRatio: config.defaultAspectRatio,
      mode: config.defaultMode,
      sound: true
    };
  }
  return userSettings[userId];
}

// Log generation
function logGeneration(userId, prompt, enhancedPrompt, cost, status) {
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    userId,
    prompt,
    enhancedPrompt,
    cost,
    status
  });
  appendLog(LOG_FILE, logEntry);
}

// Bot Commands

bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Sorry, you are not authorized to use this bot.');
  }

  const welcome = `🎬 *Kling AI Video Generator*\n\n` +
    `Welcome! I can generate stunning AI videos from your text prompts or images.\n\n` +
    `*Commands:*\n` +
    `/help - Show all commands\n` +
    `/budget - Check today's spending\n` +
    `/settings - View current settings\n` +
    `/duration 5|10 - Set video duration\n` +
    `/aspect 16:9|9:16|1:1 - Set aspect ratio\n` +
    `/mode std|pro - Set quality mode\n` +
    `/sound - Toggle sound generation 🔊/🔇\n` +
    `/enhance - Toggle AI prompt enhancement\n\n` +
    `*Usage:*\n` +
    `📝 Send text → Text-to-video\n` +
    `🖼️ Send photo with caption → Image-to-video\n\n` +
    `Let's create something amazing! 🚀`;

  bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const help = `🎬 *Kling AI Video Generator - Help*\n\n` +
    `*Commands:*\n` +
    `/start - Welcome message\n` +
    `/help - This help message\n` +
    `/budget - Show daily budget status\n` +
    `/settings - Show your current settings\n` +
    `/duration 5|10 - Set default duration (seconds)\n` +
    `/aspect 16:9|9:16|1:1 - Set aspect ratio\n` +
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

bot.onText(/\/budget/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const status = budgetTracker.formatStatus();
  bot.sendMessage(msg.chat.id, status, { parse_mode: 'Markdown' });
});

bot.onText(/\/settings/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const settings = getUserSettings(userId);
  const settingsText = `⚙️ *Your Settings*\n\n` +
    `Duration: ${settings.duration}s\n` +
    `Aspect Ratio: ${settings.aspectRatio}\n` +
    `Mode: ${settings.mode}\n` +
    `Model: ${config.defaultModel}\n` +
    `Sound: ${settings.sound ? '🔊 ON' : '🔇 OFF'}\n` +
    `Prompt Enhancement: ${promptEnhancer.isEnabled() ? '✨ ON' : '🔕 OFF'}\n\n` +
    `*Cost per video:* ${formatCurrency(KlingAPI.calculateCost(config.defaultModel, settings.mode, settings.duration))}`;

  bot.sendMessage(msg.chat.id, settingsText, { parse_mode: 'Markdown' });
});

bot.onText(/\/duration (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const duration = parseInt(match[1]);
  
  if (duration !== 5 && duration !== 10) {
    return bot.sendMessage(msg.chat.id, '❌ Duration must be 5 or 10 seconds.');
  }

  const settings = getUserSettings(userId);
  settings.duration = duration;
  
  bot.sendMessage(msg.chat.id, `✅ Default duration set to ${duration}s`);
});

bot.onText(/\/aspect (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const ratio = match[1];
  const validRatios = ['16:9', '9:16', '1:1'];
  
  if (!validRatios.includes(ratio)) {
    return bot.sendMessage(msg.chat.id, '❌ Aspect ratio must be 16:9, 9:16, or 1:1');
  }

  const settings = getUserSettings(userId);
  settings.aspectRatio = ratio;
  
  bot.sendMessage(msg.chat.id, `✅ Default aspect ratio set to ${ratio}`);
});

bot.onText(/\/mode (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const mode = match[1].toLowerCase();
  
  if (mode !== 'std' && mode !== 'pro') {
    return bot.sendMessage(msg.chat.id, '❌ Mode must be "std" or "pro"');
  }

  const settings = getUserSettings(userId);
  settings.mode = mode;
  
  bot.sendMessage(msg.chat.id, `✅ Default mode set to ${mode}`);
});

bot.onText(/\/sound/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  const settings = getUserSettings(userId);
  settings.sound = !settings.sound;
  
  bot.sendMessage(msg.chat.id, `${settings.sound ? '🔊' : '🔇'} Sound generation: ${settings.sound ? 'ON' : 'OFF'}`);
});

bot.onText(/\/enhance/, async (msg) => {
  const userId = msg.from.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(msg.chat.id, '❌ Not authorized.');
  }

  if (!promptEnhancer.isAvailable()) {
    return bot.sendMessage(msg.chat.id, 
      '❌ Enhancement not available — no API key or CLI configured.\n\n' +
      'To enable enhancement, set either:\n' +
      '• ANTHROPIC_API_KEY in .env, or\n' +
      '• CLAUDE_CLI_PATH to your Claude CLI binary'
    );
  }

  const newState = !promptEnhancer.isEnabled();
  promptEnhancer.setEnabled(newState);
  
  bot.sendMessage(msg.chat.id, `${newState ? '✨' : '🔕'} AI prompt enhancement: ${newState ? 'ON' : 'OFF'}`);
});

// Handle photo messages (image-to-video)
bot.on('photo', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(chatId, '❌ Not authorized.');
  }

  const caption = msg.caption;
  
  if (!caption || caption.trim().length === 0) {
    return bot.sendMessage(chatId, '📝 Please send the photo again with a caption describing what should happen in the video.');
  }

  // Get the largest photo
  const photo = msg.photo[msg.photo.length - 1];
  const fileId = photo.file_id;

  try {
    // Download photo and convert to base64
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data).toString('base64');
    
    await generateVideo(chatId, userId, caption, base64Image);
  } catch (error) {
    console.error('Error handling photo:', error);
    bot.sendMessage(chatId, '❌ Error processing photo: ' + error.message);
  }
});

// Handle text messages (text-to-video)
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Ignore commands and photos
  if (msg.text && msg.text.startsWith('/')) return;
  if (msg.photo) return;
  if (!msg.text) return;
  
  if (!isAllowed(userId)) {
    return bot.sendMessage(chatId, '❌ Not authorized.');
  }

  const prompt = msg.text.trim();
  
  if (prompt.length === 0) {
    return;
  }

  await generateVideo(chatId, userId, prompt, null);
});

// Main video generation function
async function generateVideo(chatId, userId, userPrompt, imageBase64 = null) {
  const settings = getUserSettings(userId);
  const cost = KlingAPI.calculateCost(config.defaultModel, settings.mode, settings.duration);

  // Check budget
  if (!budgetTracker.canAfford(cost)) {
    return bot.sendMessage(chatId, 
      `❌ Daily budget exceeded!\n\n` +
      `This video costs ${formatCurrency(cost)}\n` +
      `Remaining today: ${formatCurrency(budgetTracker.getRemaining())}\n\n` +
      `Budget resets at midnight UTC.`
    );
  }

  // Enhance prompt
  const isI2V = !!imageBase64;
  
  let enhancingMsg = null;
  if (promptEnhancer.isEnabled()) {
    enhancingMsg = await bot.sendMessage(chatId, '✨ Enhancing prompt with AI...');
  }
  
  let enhancedPrompt = userPrompt;
  try {
    enhancedPrompt = await promptEnhancer.enhance(userPrompt, isI2V);
  } catch (error) {
    console.error('Enhancement error:', error);
    enhancedPrompt = userPrompt;
  }
  
  const wasEnhanced = promptEnhancer.isEnabled() && enhancedPrompt !== userPrompt;
  
  if (enhancingMsg) {
    await bot.deleteMessage(chatId, enhancingMsg.message_id).catch(() => {});
  }
  
  console.log(`Original prompt: "${userPrompt}"`);
  console.log(`Enhanced prompt: "${enhancedPrompt}"`);

  // Show enhanced prompt to user
  if (wasEnhanced) {
    await bot.sendMessage(chatId,
      `✨ *Enhanced prompt:*\n\n${enhancedPrompt}`,
      { parse_mode: 'Markdown' }
    );
  }

  const statusMsg = await bot.sendMessage(chatId, 
    `🎬 Generating ${isI2V ? 'image-to-video' : 'text-to-video'}...\n\n` +
    `⚙️ ${settings.mode} mode | ${settings.duration}s | ${settings.aspectRatio} | ${settings.sound ? '🔊' : '🔇'}\n` +
    `💰 Cost: ${formatCurrency(cost)}\n\n` +
    `⏳ This may take 1-3 minutes...`
  );

  try {
    // Create task
    let taskResponse;
    if (imageBase64) {
      taskResponse = await klingAPI.createImageToVideo(imageBase64, enhancedPrompt, {
        model: config.defaultModel,
        mode: settings.mode,
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        sound: settings.sound
      });
    } else {
      taskResponse = await klingAPI.createTextToVideo(enhancedPrompt, {
        model: config.defaultModel,
        mode: settings.mode,
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        sound: settings.sound
      });
    }

    const taskId = taskResponse.task_id || taskResponse.data?.task_id;
    const taskType = imageBase64 ? 'image2video' : 'text2video';
    
    if (!taskId) {
      throw new Error('No task ID received from API');
    }

    console.log(`Task created: ${taskId} (${taskType})`);

    // Poll for completion
    let lastStatus = '';
    const result = await klingAPI.pollTask(taskId, taskType, (status) => {
      const currentStatus = status.data?.task_status || status.task_status || status.status || 'processing';
      if (currentStatus !== lastStatus) {
        console.log(`Task ${taskId} status: ${currentStatus}`);
        lastStatus = currentStatus;
      }
    });

    // Get video URL
    const videoUrl = result.task_result?.videos?.[0]?.url || result.data?.task_result?.videos?.[0]?.url;
    
    if (!videoUrl) {
      throw new Error('No video URL in response');
    }

    // Track expense
    budgetTracker.addExpense(cost, {
      userId,
      prompt: userPrompt,
      enhancedPrompt,
      duration: settings.duration,
      mode: settings.mode
    });

    // Log generation
    logGeneration(userId, userPrompt, enhancedPrompt, cost, 'success');

    // Send video
    await bot.editMessageText(
      `✅ *Video generated!*\n\n` +
      `Prompt: "${userPrompt}"\n` +
      `Cost: ${formatCurrency(cost)}\n\n` +
      `Downloading...`,
      {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown'
      }
    );

    // Download video locally first (Telegram can't fetch Kling CDN URLs directly)
    const fs = require('fs');
    const tmpPath = `/tmp/kling-${taskId}.mp4`;
    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
    fs.writeFileSync(tmpPath, Buffer.from(videoResponse.data));
    
    await bot.sendVideo(chatId, tmpPath, {
      caption: `🎬 "${userPrompt}"\n\n⚙️ ${settings.mode} • ${settings.duration}s • ${settings.aspectRatio}`
    });
    
    // Cleanup
    fs.unlinkSync(tmpPath);

    await bot.deleteMessage(chatId, statusMsg.message_id);

    // Send budget update
    const remaining = budgetTracker.getRemaining();
    bot.sendMessage(chatId, `💰 Remaining today: ${formatCurrency(remaining)}`);

  } catch (error) {
    console.error('Error generating video:', error);
    
    logGeneration(userId, userPrompt, enhancedPrompt, 0, 'failed');
    
    // Send error without Markdown to avoid parse errors from special chars
    await bot.editMessageText(
      `❌ Video generation failed\n\nError: ${error.message}\n\nYour budget was not charged.`,
      {
        chat_id: chatId,
        message_id: statusMsg.message_id
      }
    );
  }
}

// Graceful shutdown
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
if (config.allowedUserIds && config.allowedUserIds.length > 0) {
  console.log(`Allowed users: ${config.allowedUserIds.join(', ')}`);
} else {
  console.log('Allowed users: Anyone (no whitelist)');
}
console.log(`Daily budget: $${config.dailyBudgetUsd}`);
