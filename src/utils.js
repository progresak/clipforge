const fs = require('fs');
const path = require('path');

/**
 * Load JSON file safely
 */
function loadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading JSON from ${filePath}:`, error.message);
  }
  return defaultValue;
}

/**
 * Save JSON file safely
 */
function saveJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving JSON to ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Append to log file
 */
function appendLog(filePath, message) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(filePath, logLine, 'utf8');
  } catch (error) {
    console.error(`Error appending to log ${filePath}:`, error.message);
  }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get current date string (YYYY-MM-DD)
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Sleep/delay utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  loadJSON,
  saveJSON,
  appendLog,
  formatCurrency,
  getCurrentDate,
  sleep
};
