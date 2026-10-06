export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface CoreLogger {
  debug(message: string, context?: unknown): void
  info(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
  error(message: string, context?: unknown): void
}

export const createLogger = (scope: string, debugEnabled = false): CoreLogger => {
  const write = (level: LogLevel, message: string, context?: unknown): void => {
    if (level === 'debug' && !debugEnabled) return
    console[level]('[' + scope + '] ' + message, context ?? '')
  }
  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  }
}

