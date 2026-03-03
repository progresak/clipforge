const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ENHANCE_PROMPT_FILE = path.join(__dirname, '../prompts/enhance-video.txt');

class PromptEnhancer {
  constructor() {
    this.systemPrompt = this.loadSystemPrompt();
    this.enabled = true;
    this.mode = this.detectMode();
    
    if (this.mode === 'disabled') {
      console.log('ℹ️  Prompt enhancement: DISABLED (no API key or CLI configured)');
      this.enabled = false;
    } else if (this.mode === 'api') {
      console.log('✨ Prompt enhancement: Anthropic API');
    } else if (this.mode === 'cli') {
      console.log('✨ Prompt enhancement: Claude CLI');
    }
  }

  /**
   * Detect which enhancement mode to use
   * Priority: API > CLI > disabled
   */
  detectMode() {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0) {
      return 'api';
    }
    
    const cliPath = process.env.CLAUDE_CLI_PATH || 'claude';
    try {
      execSync(`which ${cliPath}`, { stdio: 'ignore' });
      return 'cli';
    } catch {
      return 'disabled';
    }
  }

  loadSystemPrompt() {
    try {
      if (fs.existsSync(ENHANCE_PROMPT_FILE)) {
        return fs.readFileSync(ENHANCE_PROMPT_FILE, 'utf8').trim();
      }
    } catch (error) {
      console.error('Error loading enhancement prompt:', error.message);
    }
    return '';
  }

  setEnabled(enabled) {
    if (this.mode === 'disabled' && enabled) {
      // Can't enable if no API key or CLI is available
      return false;
    }
    this.enabled = enabled;
    return true;
  }

  isEnabled() {
    return this.enabled && this.mode !== 'disabled';
  }

  isAvailable() {
    return this.mode !== 'disabled';
  }

  /**
   * Enhance a user prompt using configured method
   * @param {string} userPrompt - The user's original prompt
   * @param {boolean} isImageToVideo - Whether this is an image-to-video generation
   * @returns {Promise<string>} Enhanced prompt
   */
  async enhance(userPrompt, isImageToVideo = false) {
    if (!this.enabled || this.mode === 'disabled') {
      return userPrompt;
    }

    if (!userPrompt || userPrompt.trim().length === 0) {
      return userPrompt;
    }

    try {
      const mode = isImageToVideo ? 'IMAGE-TO-VIDEO' : 'TEXT-TO-VIDEO';
      const message = `Mode: ${mode}\nUser prompt: ${userPrompt}`;
      
      let enhanced;
      if (this.mode === 'api') {
        enhanced = await this.enhanceWithAPI(message);
      } else if (this.mode === 'cli') {
        enhanced = this.enhanceWithCLI(message);
      } else {
        return userPrompt;
      }
      
      if (enhanced && enhanced.length > 10) {
        return enhanced;
      }
      
      console.warn('Enhancement returned empty/short response, using original prompt');
      return userPrompt;
    } catch (error) {
      console.error('Enhancement failed:', error.message);
      console.error('Falling back to original prompt');
      return userPrompt;
    }
  }

  /**
   * Enhance using Anthropic API
   */
  enhanceWithAPI(message) {
    const fullPrompt = this.systemPrompt + '\n\n' + message;
    
    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 45000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API returned status ${res.statusCode}: ${data}`));
              return;
            }

            const response = JSON.parse(data);
            const content = response.content?.[0]?.text;
            
            if (!content) {
              reject(new Error('No content in API response'));
              return;
            }

            resolve(content.trim());
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('API request timeout'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * Enhance using Claude CLI
   */
  enhanceWithCLI(message) {
    const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
    const fullPrompt = this.systemPrompt + '\n\n' + message;
    
    const result = execSync(
      `${claudePath} -p --model sonnet`,
      {
        input: fullPrompt,
        encoding: 'utf8',
        timeout: 45000,
        maxBuffer: 1024 * 1024
      }
    );

    return result.trim();
  }
}

module.exports = PromptEnhancer;
