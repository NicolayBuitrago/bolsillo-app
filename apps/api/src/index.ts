import { createDb, pingDb } from '@bolsillo/db';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { EnvValidationError, loadEnv } from './env';
import { createLogger } from './logger';

function readEnv() {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const env = readEnv();
const logger = createLogger(env);
const database = createDb(env.DATABASE_URL);

const app = createApp({ env, logger, checkDb: () => pingDb(database.db) });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port, env: env.NODE_ENV }, 'api listening');
});

function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    database.close().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
