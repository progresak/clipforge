import axios from 'axios';
import crypto from 'node:crypto';
import { sleep } from './utils.js';
import type {
  KlingVideoGenerationOptions,
  KlingTextToVideoPayload,
  KlingImageToVideoPayload,
  KlingTaskResponse,
  KlingStatusResponse,
  KlingTaskType,
  KlingModel,
  KlingMode,
  KlingDuration,
} from './types/index.js';

const API_BASE = 'https://api.klingai.com';

export class KlingAPI {
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(accessKey: string, secretKey: string) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
  }

  /** Generate JWT token for authentication */
  private generateJWT(): string {
    const header = { alg: 'HS256' as const, typ: 'JWT' as const };
    const payload = {
      iss: this.accessKey,
      exp: Math.floor(Date.now() / 1000) + 1800,
      nbf: Math.floor(Date.now() / 1000) - 5,
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

  /** Make authenticated API request */
  private async request<T>(method: string, endpoint: string, data?: unknown): Promise<T> {
    const jwt = this.generateJWT();
    const url = `${API_BASE}${endpoint}`;

    try {
      const response = await axios<T>({
        method,
        url,
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        ...(data ? { data } : {}),
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `Kling API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      }
      throw error;
    }
  }

  /** Create text-to-video task */
  async createTextToVideo(
    prompt: string,
    options: KlingVideoGenerationOptions = {}
  ): Promise<KlingTaskResponse> {
    const payload: KlingTextToVideoPayload = {
      model_name: options.model ?? 'kling-v2-6',
      prompt,
      mode: options.mode ?? 'pro',
      duration: options.duration ?? 5,
      aspect_ratio: options.aspectRatio ?? '16:9',
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.cfgScale && { cfg_scale: options.cfgScale }),
      ...(options.camera && { camera_control: options.camera }),
      ...(options.sound !== undefined && { sound: options.sound ? 'on' as const : 'off' as const }),
    };

    return this.request<KlingTaskResponse>('POST', '/v1/videos/text2video', payload);
  }

  /** Create image-to-video task */
  async createImageToVideo(
    imageInput: string,
    prompt: string,
    options: KlingVideoGenerationOptions = {}
  ): Promise<KlingTaskResponse> {
    const payload: KlingImageToVideoPayload = {
      model_name: options.model ?? 'kling-v2-6',
      image: imageInput,
      prompt,
      mode: options.mode ?? 'pro',
      duration: options.duration ?? 5,
      aspect_ratio: options.aspectRatio ?? '16:9',
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.cfgScale && { cfg_scale: options.cfgScale }),
      ...(options.camera && { camera_control: options.camera }),
      ...(options.sound !== undefined && { sound: options.sound ? 'on' as const : 'off' as const }),
    };

    return this.request<KlingTaskResponse>('POST', '/v1/videos/image2video', payload);
  }

  /** Get task status */
  async getTaskStatus(taskId: string, taskType: KlingTaskType = 'text2video'): Promise<KlingStatusResponse> {
    return this.request<KlingStatusResponse>('GET', `/v1/videos/${taskType}/${taskId}`);
  }

  /** Poll task until completion */
  async pollTask(
    taskId: string,
    taskType: KlingTaskType = 'text2video',
    onProgress?: ((status: KlingStatusResponse) => void) | null,
    maxAttempts = 120,
    intervalMs = 5000
  ): Promise<KlingStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getTaskStatus(taskId, taskType);

      if (onProgress) {
        onProgress(status);
      }

      const taskStatus = status.data?.task_status ?? status.task_status ?? status.status;

      if (taskStatus === 'succeed') {
        return status;
      }

      if (taskStatus === 'failed') {
        const msg = status.data?.task_status_msg ?? status.task_status_msg ?? 'Unknown error';
        throw new Error(`Task failed: ${msg}`);
      }

      await sleep(intervalMs);
    }

    throw new Error('Task polling timeout');
  }

  /** Calculate cost based on model, mode, and duration */
  static calculateCost(model: KlingModel, mode: KlingMode, duration: KlingDuration): number {
    if (model === 'kling-v2-6' && mode === 'pro') {
      if (duration === 5) return 0.33;
      if (duration === 10) return 0.66;
    }

    if (duration === 5) return 0.15;
    if (duration === 10) return 0.30;

    return 0.33;
  }
}
