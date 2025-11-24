import morgan from 'morgan';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Track current log file date to detect day changes
let currentLogDate = null;

// Function to get current date string for log file naming
const getLogFileName = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `api-${year}-${month}-${day}.log`;
};

// Function to get current date string (YYYY-MM-DD)
const getCurrentDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Function to format timestamp
const getTimestamp = () => {
  const date = new Date();
  return date.toISOString();
};

// Function to write log to file with error handling
const writeLogToFile = (logEntry, isError = false) => {
  try {
    const today = getCurrentDateString();
    
    // Check if we need to create a new log file for a new day
    if (currentLogDate !== today) {
      currentLogDate = today;
      console.log(chalk.cyan(`[Logger] New day detected. Creating log file: api-${today}.log`));
    }
    
    const logFileName = getLogFileName();
    const logFilePath = path.join(logsDir, logFileName);
    const timestamp = getTimestamp();
    
    // Mark errors clearly in the log file
    const logPrefix = isError ? '[ERROR]' : '[INFO]';
    const logLine = `[${timestamp}] ${logPrefix} ${logEntry}\n`;
    
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (error) {
    // Fallback: log to console if file write fails
    console.error(chalk.red('[Logger Error] Failed to write to log file:'), error.message);
    console.error(chalk.red('[Logger Error] Log entry:'), logEntry);
  }
};

// Export function to log errors directly from controllers
export const logError = (error, context = '') => {
  const timestamp = getTimestamp();
  const errorMessage = error?.message || String(error);
  const errorStack = error?.stack || '';
  const contextInfo = context ? ` | Context: ${context}` : '';
  
  const errorLog = `ERROR LOG${contextInfo} | Message: ${errorMessage}${errorStack ? ` | Stack: ${errorStack}` : ''}`;
  
  writeLogToFile(errorLog, true);
  console.error(chalk.red('[Error]'), errorMessage, context ? chalk.yellow(`(${context})`) : '');
};

// Custom morgan logging format
const customFormat = morgan(function (tokens, req, res) {
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const status = tokens.status(req, res);
  const responseTime = tokens['response-time'](req, res);
  const remoteAddr = tokens['remote-addr'](req, res);
  const userAgent = tokens['user-agent'](req, res);
  
  // Determine if this is an error (4xx or 5xx status codes)
  const statusNum = parseInt(status, 10);
  const isError = statusNum >= 400;
  
  // Get error message from response if available
  let errorMessage = '';
  if (isError && res.locals.errorMessage) {
    errorMessage = ` | Error: ${res.locals.errorMessage}`;
  }
  
  // Console log with colors (red for errors)
  let consoleLog;
  if (isError) {
    consoleLog = [
      chalk.red(`[${method}]`),
      chalk.yellow(url),
      chalk.red(`Status: ${status}`),
      chalk.magenta(`${responseTime} ms`)
    ].join(' ');
  } else {
    consoleLog = [
      chalk.green(`[${method}]`),
      chalk.yellow(url),
      chalk.blue(`Status: ${status}`),
      chalk.magenta(`${responseTime} ms`)
    ].join(' ');
  }
  
  // File log without colors (plain text) with error marking
  const fileLog = `[${method}] ${url} | Status: ${status} | Response Time: ${responseTime} ms | IP: ${remoteAddr} | User-Agent: ${userAgent}${errorMessage}`;
  
  // Write to file (mark as error if status >= 400)
  writeLogToFile(fileLog, isError);
  
  // Return console log
  return consoleLog;
});

export default customFormat;
