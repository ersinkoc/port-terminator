import type { LogLevel, ILogger } from '../types';

interface IColorMap {
  reset: string;
  bright: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
}

const colors: IColorMap = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const logLevels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class Logger implements ILogger {
  private level: LogLevel = 'info';
  private silent = false;

  constructor(level: LogLevel = 'info', silent = false) {
    this.level = level;
    this.silent = silent;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public setSilent(silent: boolean): void {
    this.silent = silent;
  }

  public error(message: string, ...args: unknown[]): void {
    this.log('error', colors.red, message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.log('warn', colors.yellow, message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.log('info', colors.blue, message, ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    this.log('debug', colors.dim, message, ...args);
  }

  private log(level: LogLevel, color: string, message: string, ...args: unknown[]): void {
    if (this.silent || logLevels[level] > logLevels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const coloredLevel = `${color}${levelStr}${colors.reset}`;

    const formattedMessage = this.formatMessage(message, args);

    const output = `[${timestamp}] ${coloredLevel} ${formattedMessage}`;

    if (level === 'error') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  private formatMessage(message: string, args: unknown[]): string {
    return message.replace(/%./g, (match) => {
      switch (match) {
        case '%%':
          return '%';
        case '%s':
        case '%d':
        case '%j':
        case '%o': {
          if (args.length === 0) return match;
          const arg = args.shift();
          switch (match) {
            case '%s':
              return String(arg);
            case '%d':
              return Number(arg).toString();
            case '%j':
            case '%o':
              try {
                return JSON.stringify(arg);
              } catch {
                return '[Circular]';
              }
          }
          /* istanbul ignore next */
          return match;
        }
        default:
          return match;
      }
    });
  }

  public static create(level?: LogLevel, silent?: boolean): Logger {
    return new Logger(level, silent);
  }
}

export const defaultLogger = new Logger();
