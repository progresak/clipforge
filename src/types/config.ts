import type { KlingModel, KlingMode, KlingDuration, KlingAspectRatio } from './kling.js';

export interface AppConfig {
  telegramBotToken: string;
  klingAccessKey: string;
  klingSecretKey: string;
  allowedUserIds: number[];
  dailyBudgetUsd: number;
  defaultModel: KlingModel;
  defaultMode: KlingMode;
  defaultDuration: KlingDuration;
  defaultAspectRatio: KlingAspectRatio;
}

export interface UserSettings {
  duration: KlingDuration;
  aspectRatio: KlingAspectRatio;
  mode: KlingMode;
  sound: boolean;
}

export interface GenerationLogEntry {
  timestamp: string;
  userId: number;
  prompt: string;
  enhancedPrompt: string;
  cost: number;
  status: 'success' | 'failed';
}

export interface BudgetData {
  date: string;
  spent: number;
  generations: BudgetGenerationEntry[];
}

export interface BudgetGenerationEntry {
  timestamp: string;
  cost: number;
  userId?: number;
  prompt?: string;
  enhancedPrompt?: string;
  duration?: number;
  mode?: string;
}

export interface BudgetStatus {
  date: string;
  limit: number;
  spent: number;
  remaining: number;
  generationsToday: number;
}

export type EnhancementMode = 'api' | 'cli' | 'disabled';
