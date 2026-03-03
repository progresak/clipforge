const axios = require('axios');
const crypto = require('crypto');
const { sleep } = require('./utils');

const API_BASE = 'https://api.klingai.com';

class KlingAPI {
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /**
   * Generate JWT token for authentication
   */
  generateJWT() {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      iss: this.accessKey,
      exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
      nbf: Math.floor(Date.now() / 1000) - 5
    };

    const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signatureInput = `${base64Header}.${base64Payload}`;
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(signatureInput)
      .digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Make authenticated API request
   */
  async request(method, endpoint, data = null) {
    const jwt = this.generateJWT();
    const url = `${API_BASE}${endpoint}`;

    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Kling API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Create text-to-video task
   */
  async createTextToVideo(prompt, options = {}) {
    const payload = {
      model_name: options.model || 'kling-v2-6',
      prompt: prompt,
      mode: options.mode || 'pro',
      duration: options.duration || 5,
      aspect_ratio: options.aspectRatio || '16:9',
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.cfgScale && { cfg_scale: options.cfgScale }),
      ...(options.camera && { camera_control: options.camera }),
      ...(options.sound !== undefined && { sound: options.sound ? 'on' : 'off' })
    };

    return await this.request('POST', '/v1/videos/text2video', payload);
  }

  /**
   * Create image-to-video task
   */
  async createImageToVideo(imageInput, prompt, options = {}) {
    const payload = {
      model_name: options.model || 'kling-v2-6',
      image: imageInput, // URL (publicly accessible) or base64 string
      prompt: prompt,
      mode: options.mode || 'pro',
      duration: options.duration || 5,
      aspect_ratio: options.aspectRatio || '16:9',
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.cfgScale && { cfg_scale: options.cfgScale }),
      ...(options.camera && { camera_control: options.camera }),
      ...(options.sound !== undefined && { sound: options.sound ? 'on' : 'off' })
    };

    return await this.request('POST', '/v1/videos/image2video', payload);
  }

  /**
   * Get task status
   * @param {string} taskId
   * @param {string} taskType - 'text2video' or 'image2video'
   */
  async getTaskStatus(taskId, taskType = 'text2video') {
    return await this.request('GET', `/v1/videos/${taskType}/${taskId}`);
  }

  /**
   * Poll task until completion
   */
  async pollTask(taskId, taskType = 'text2video', onProgress = null, maxAttempts = 120, intervalMs = 5000) {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getTaskStatus(taskId, taskType);
      
      if (onProgress) {
        onProgress(status);
      }

      // Check status — response may be {data: {task_status}} or flat {task_status}
      const taskStatus = status.data?.task_status || status.task_status || status.status;
      
      if (taskStatus === 'succeed') {
        return status;
      }

      if (taskStatus === 'failed') {
        throw new Error(`Task failed: ${status.data?.task_status_msg || status.task_status_msg || 'Unknown error'}`);
      }

      // Still processing
      await sleep(intervalMs);
    }

    throw new Error('Task polling timeout');
  }

  /**
   * Calculate cost based on model, mode, and duration
   */
  static calculateCost(model, mode, duration) {
    // Pricing for v2.6 pro mode
    if (model === 'kling-v2-6' && mode === 'pro') {
      if (duration === 5) return 0.33;
      if (duration === 10) return 0.66;
    }
    
    // Default fallback (standard mode is typically cheaper)
    if (duration === 5) return 0.15;
    if (duration === 10) return 0.30;
    
    return 0.33; // Safe default
  }
}

module.exports = KlingAPI;
