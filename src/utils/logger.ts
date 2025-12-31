import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Log file path - write to temp directory
const logFilePath = path.join(os.tmpdir(), 'alko-mcp.log');

// Create a write stream for file logging
const logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });

/**
 * Application logger using pino
 * IMPORTANT: Writes to stderr AND a log file for debugging
 * MCP uses stdout for JSON-RPC communication, so all logs must go to stderr
 */
const pinoLogger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  // Write to multiple destinations: stderr and log file
  pino.multistream([
    { stream: pino.destination(2) }, // stderr
    { stream: logFileStream }, // log file
  ])
);

// Log the log file location on startup
pinoLogger.info(`Log file: ${logFilePath}`);

/**
 * Simplified logger wrapper with consistent API
 */
export const logger = {
  info: (msg: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.info(obj, msg);
    } else {
      pinoLogger.info(msg);
    }
  },
  error: (msg: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.error(obj, msg);
    } else {
      pinoLogger.error(msg);
    }
  },
  warn: (msg: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.warn(obj, msg);
    } else {
      pinoLogger.warn(msg);
    }
  },
  debug: (msg: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.debug(obj, msg);
    } else {
      pinoLogger.debug(msg);
    }
  },
};

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return pinoLogger.child(context);
}
