type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  isDevelopment: boolean;
  minLevel: LogLevel;
}

class Logger {
  private config: LoggerConfig;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: LoggerConfig) {
    this.config = config;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (this.config.isDevelopment) {
      // In development, use colored console logs
      const styles: Record<LogLevel, string> = {
        debug: "color: #6B7280",
        info: "color: #3B82F6",
        warn: "color: #F59E0B",
        error: "color: #EF4444",
      };

      console.log(`%c${prefix} ${message}`, styles[level], meta || "");
    } else {
      // In production, use structured logs
      const logData = {
        timestamp,
        level,
        message,
        ...(meta || {}),
      };

      if (level === "error") {
        console.error(JSON.stringify(logData));
      } else if (level === "warn") {
        console.warn(JSON.stringify(logData));
      } else {
        console.log(JSON.stringify(logData));
      }
    }
  }

  debug(message: string, meta?: any): void {
    this.formatMessage("debug", message, meta);
  }

  info(message: string, meta?: any): void {
    this.formatMessage("info", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.formatMessage("warn", message, meta);
  }

  error(message: string, error?: unknown, meta?: any): void {
    const errorMeta =
      error instanceof Error
        ? {
            errorMessage: error.message,
            errorStack: error.stack,
            ...meta,
          }
        : { error, ...meta };

    this.formatMessage("error", message, errorMeta);
  }
}

// Create and export logger instance
export const logger = new Logger({
  isDevelopment: import.meta.env.DEV,
  minLevel: import.meta.env.DEV ? "debug" : "error",
});
