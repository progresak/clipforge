import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { EnhancementMode } from './types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENHANCE_PROMPT_FILE = path.join(__dirname, '../prompts/enhance-video.txt');

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text: string }>;
}

export class PromptEnhancer {
  private readonly systemPrompt: string;
  private enabled: boolean;
  private readonly mode: EnhancementMode;

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

  private detectMode(): EnhancementMode {
    if (process.env['ANTHROPIC_API_KEY']?.trim()) {
      return 'api';
    }

    const cliPath = process.env['CLAUDE_CLI_PATH'] || 'claude';
    try {
      execSync(`which ${cliPath}`, { stdio: 'ignore' });
      return 'cli';
    } catch {
      return 'disabled';
    }
  }

  private loadSystemPrompt(): string {
    try {
      if (fs.existsSync(ENHANCE_PROMPT_FILE)) {
        return fs.readFileSync(ENHANCE_PROMPT_FILE, 'utf8').trim();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error loading enhancement prompt:', message);
    }
    return '';
  }

  setEnabled(enabled: boolean): boolean {
    if (this.mode === 'disabled' && enabled) {
      return false;
    }
    this.enabled = enabled;
    return true;
  }

  isEnabled(): boolean {
    return this.enabled && this.mode !== 'disabled';
  }

  isAvailable(): boolean {
    return this.mode !== 'disabled';
  }

  async enhance(userPrompt: string, isImageToVideo = false): Promise<string> {
    if (!this.enabled || this.mode === 'disabled') {
      return userPrompt;
    }

    if (!userPrompt?.trim()) {
      return userPrompt;
    }

    try {
      const mode = isImageToVideo ? 'IMAGE-TO-VIDEO' : 'TEXT-TO-VIDEO';
      const message = `Mode: ${mode}\nUser prompt: ${userPrompt}`;

      let enhanced: string;
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
      const message = error instanceof Error ? error.message : String(error);
      console.error('Enhancement failed:', message);
      console.error('Falling back to original prompt');
      return userPrompt;
    }
  }

  private enhanceWithAPI(message: string): Promise<string> {
    const fullPrompt = this.systemPrompt + '\n\n' + message;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: fullPrompt }] satisfies AnthropicMessage[],
    });

    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env['ANTHROPIC_API_KEY'] ?? '',
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout: 45000,
    };

    return new Promise<string>((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API returned status ${res.statusCode}: ${data}`));
              return;
            }
            const response = JSON.parse(data) as AnthropicResponse;
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

  private enhanceWithCLI(message: string): string {
    const claudePath = process.env['CLAUDE_CLI_PATH'] || 'claude';
    const fullPrompt = this.systemPrompt + '\n\n' + message;

    const result = execSync(`${claudePath} -p --model sonnet`, {
      input: fullPrompt,
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 1024 * 1024,
    });

    return result.trim();
  }
}
