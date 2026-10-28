import { type DestinationStream, type Logger, type LoggerOptions, pino } from 'pino';
import type { Env } from './env';

export type { Logger };

/**
 * Structured JSON logger. Never log request bodies, capture texts, amounts or
 * merchants (docs/06-convenciones.md).
 */
export function createLogger(
  env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
      censor: '[redacted]',
    },
  };
  if (destination) {
    return pino(options, destination);
  }
  if (env.NODE_ENV === 'development' && process.stdout.isTTY) {
    return pino({ ...options, transport: { target: 'pino-pretty' } });
  }
  return pino(options);
}
