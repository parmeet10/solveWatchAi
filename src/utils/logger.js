/**
 * Production-level logger utility
 * Provides structured logging with appropriate log levels
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const CURRENT_LOG_LEVEL =
  LOG_LEVELS[LOG_LEVEL.toUpperCase()] ?? LOG_LEVELS.INFO;

class Logger {
  constructor(module) {
    this.module = module || 'App';
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= CURRENT_LOG_LEVEL;
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.module}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }

  error(message, error = null) {
    if (this._shouldLog('ERROR')) {
      if (error) {
        console.error(this._formatMessage('ERROR', message), error);
      } else {
        console.error(this._formatMessage('ERROR', message));
      }
    }
  }

  warn(message, data = null) {
    if (this._shouldLog('WARN')) {
      console.warn(this._formatMessage('WARN', message, data));
    }
  }

  info(message, data = null) {
    if (this._shouldLog('INFO')) {
      console.log(this._formatMessage('INFO', message, data));
    }
  }

  debug(message, data = null) {
    if (this._shouldLog('DEBUG')) {
      console.log(this._formatMessage('DEBUG', message, data));
    }
  }
}

export default (module) => new Logger(module);
