import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJSON, saveJSON, getCurrentDate, formatCurrency } from './utils.js';
import type { BudgetData, BudgetGenerationEntry, BudgetStatus } from './types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = path.join(__dirname, '../data/budget.json');

export class BudgetTracker {
  private readonly dailyLimit: number;
  private data: BudgetData;

  constructor(dailyLimit: number) {
    this.dailyLimit = dailyLimit;
    this.data = this.loadBudgetData();
    this.resetIfNewDay();
  }

  private loadBudgetData(): BudgetData {
    return loadJSON<BudgetData>(BUDGET_FILE, {
      date: getCurrentDate(),
      spent: 0,
      generations: [],
    });
  }

  private saveBudgetData(): void {
    saveJSON(BUDGET_FILE, this.data);
  }

  private resetIfNewDay(): void {
    const today = getCurrentDate();
    if (this.data.date !== today) {
      console.log(`New day detected. Resetting budget. Previous: ${this.data.date}, Current: ${today}`);
      this.data = { date: today, spent: 0, generations: [] };
      this.saveBudgetData();
    }
  }

  canAfford(cost: number): boolean {
    this.resetIfNewDay();
    return this.data.spent + cost <= this.dailyLimit;
  }

  addExpense(cost: number, details: Omit<BudgetGenerationEntry, 'timestamp' | 'cost'> = {}): void {
    this.resetIfNewDay();
    this.data.spent += cost;
    this.data.generations.push({
      timestamp: new Date().toISOString(),
      cost,
      ...details,
    });
    this.saveBudgetData();
  }

  getRemaining(): number {
    this.resetIfNewDay();
    return Math.max(0, this.dailyLimit - this.data.spent);
  }

  getSpent(): number {
    this.resetIfNewDay();
    return this.data.spent;
  }

  getBudgetStatus(): BudgetStatus {
    this.resetIfNewDay();
    return {
      date: this.data.date,
      limit: this.dailyLimit,
      spent: this.data.spent,
      remaining: this.getRemaining(),
      generationsToday: this.data.generations.length,
    };
  }

  formatStatus(): string {
    const status = this.getBudgetStatus();
    return (
      `📊 *Budget Status (${status.date})*\n\n` +
      `Daily Limit: ${formatCurrency(status.limit)}\n` +
      `Spent Today: ${formatCurrency(status.spent)}\n` +
      `Remaining: ${formatCurrency(status.remaining)}\n` +
      `Videos Generated: ${status.generationsToday}`
    );
  }
}
