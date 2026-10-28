import { createApp } from '../app';
import { createLogger } from '../logger';

export const TEST_WEB_ORIGIN = 'http://localhost:3001';

/** Logger that keeps every line in memory so tests can inspect what was logged. */
export function createMemoryLogger() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger(
    { LOG_LEVEL: 'info', NODE_ENV: 'test' },
    { write: (line: string) => lines.push(JSON.parse(line)) },
  );
  return { logger, lines };
}

export function createTestApp(checkDb: () => Promise<boolean>) {
  const { logger, lines } = createMemoryLogger();
  const app = createApp({ env: { WEB_ORIGIN: TEST_WEB_ORIGIN }, logger, checkDb });
  return { app, logs: lines };
}
