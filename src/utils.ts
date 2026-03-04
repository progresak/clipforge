import fs from 'node:fs';
import path from 'node:path';

export function loadJSON<T>(filePath: string, defaultValue: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as T;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error loading JSON from ${filePath}:`, message);
  }
  return defaultValue;
}

export function saveJSON(filePath: string, data: unknown): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error saving JSON to ${filePath}:`, message);
    return false;
  }
}

export function appendLog(filePath: string, message: string): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error appending to log ${filePath}:`, msg);
  }
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect the closest Kling-supported aspect ratio from image dimensions.
 * Kling supports: 16:9, 9:16, 1:1
 */
export function detectAspectRatio(width: number, height: number): '16:9' | '9:16' | '1:1' {
  const ratio = width / height;
  // 16:9 = 1.778, 1:1 = 1.0, 9:16 = 0.5625
  const options: Array<{ ar: '16:9' | '9:16' | '1:1'; value: number }> = [
    { ar: '16:9', value: 16 / 9 },
    { ar: '1:1', value: 1 },
    { ar: '9:16', value: 9 / 16 },
  ];

  let closest = options[0]!;
  let minDiff = Math.abs(ratio - closest.value);

  for (const opt of options) {
    const diff = Math.abs(ratio - opt.value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }

  return closest.ar;
}
