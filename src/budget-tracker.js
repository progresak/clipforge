const path = require('path');
const { loadJSON, saveJSON, getCurrentDate, formatCurrency } = require('./utils');

const BUDGET_FILE = path.join(__dirname, '../data/budget.json');

class BudgetTracker {
  constructor(dailyLimit) {
    this.dailyLimit = dailyLimit;
    this.data = this.loadBudgetData();
    this.resetIfNewDay();
  }

  loadBudgetData() {
    return loadJSON(BUDGET_FILE, {
      date: getCurrentDate(),
      spent: 0,
      generations: []
    });
  }

  saveBudgetData() {
    saveJSON(BUDGET_FILE, this.data);
  }

  resetIfNewDay() {
    const today = getCurrentDate();
    if (this.data.date !== today) {
      console.log(`New day detected. Resetting budget. Previous: ${this.data.date}, Current: ${today}`);
      this.data = {
        date: today,
        spent: 0,
        generations: []
      };
      this.saveBudgetData();
    }
  }

  canAfford(cost) {
    this.resetIfNewDay();
    return (this.data.spent + cost) <= this.dailyLimit;
  }

  addExpense(cost, details = {}) {
    this.resetIfNewDay();
    
    this.data.spent += cost;
    this.data.generations.push({
      timestamp: new Date().toISOString(),
      cost,
      ...details
    });
    
    this.saveBudgetData();
  }

  getRemaining() {
    this.resetIfNewDay();
    return Math.max(0, this.dailyLimit - this.data.spent);
  }

  getSpent() {
    this.resetIfNewDay();
    return this.data.spent;
  }

  getBudgetStatus() {
    this.resetIfNewDay();
    return {
      date: this.data.date,
      limit: this.dailyLimit,
      spent: this.data.spent,
      remaining: this.getRemaining(),
      generationsToday: this.data.generations.length
    };
  }

  formatStatus() {
    const status = this.getBudgetStatus();
    return `📊 *Budget Status (${status.date})*\n\n` +
           `Daily Limit: ${formatCurrency(status.limit)}\n` +
           `Spent Today: ${formatCurrency(status.spent)}\n` +
           `Remaining: ${formatCurrency(status.remaining)}\n` +
           `Videos Generated: ${status.generationsToday}`;
  }
}

module.exports = BudgetTracker;
