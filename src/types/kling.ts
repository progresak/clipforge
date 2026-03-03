// Kling AI API types

export interface KlingJWTHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface KlingJWTPayload {
  iss: string;
  exp: number;
  nbf: number;
}

export type KlingModel = 'kling-v1' | 'kling-v1-5' | 'kling-v1-6' | 'kling-v2' | 'kling-v2-6';
export type KlingMode = 'std' | 'pro';
export type KlingDuration = 5 | 10;
export type KlingAspectRatio = '16:9' | '9:16' | '1:1';
export type KlingSoundSetting = 'on' | 'off';
export type KlingTaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed';
export type KlingTaskType = 'text2video' | 'image2video';

export interface KlingVideoGenerationOptions {
  model?: KlingModel;
  mode?: KlingMode;
  duration?: KlingDuration;
  aspectRatio?: KlingAspectRatio;
  negativePrompt?: string;
  cfgScale?: number;
  camera?: Record<string, unknown>;
  sound?: boolean;
}

export interface KlingTextToVideoPayload {
  model_name: string;
  prompt: string;
  mode: string;
  duration: number;
  aspect_ratio: string;
  negative_prompt?: string;
  cfg_scale?: number;
  camera_control?: Record<string, unknown>;
  sound?: KlingSoundSetting;
}

export interface KlingImageToVideoPayload extends KlingTextToVideoPayload {
  image: string;
}

export interface KlingVideoResult {
  id: string;
  url: string;
  duration: string;
}

export interface KlingTaskData {
  task_id: string;
  task_status: KlingTaskStatus;
  task_status_msg?: string;
  task_result?: {
    videos?: KlingVideoResult[];
  };
}

export interface KlingAPIResponse<T = KlingTaskData> {
  code: number;
  message: string;
  request_id: string;
  data?: T;
  // Flat response format (some endpoints)
  task_id?: string;
  task_status?: KlingTaskStatus;
  task_status_msg?: string;
  task_result?: {
    videos?: KlingVideoResult[];
  };
  status?: string;
}

export type KlingTaskResponse = KlingAPIResponse<KlingTaskData>;
export type KlingStatusResponse = KlingAPIResponse<KlingTaskData>;
