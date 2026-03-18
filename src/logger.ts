type LogLevel = 'info' | 'warn' | 'error';

interface ILogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const entry: ILogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>): void => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => log('error', message, meta)
};
