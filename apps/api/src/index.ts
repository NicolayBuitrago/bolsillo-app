import { EnvValidationError, loadEnv } from './env';

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

// Validate the environment before loading the rest of the app, so a
// misconfigured process fails fast.
const env = readEnv();

const [{ createDb }, { serve }, { createApp }, { createAuth }, { startJobs }, { createLogger }] =
  await Promise.all([
    import('@bolsillo/db'),
    import('@hono/node-server'),
    import('./app'),
    import('./auth'),
    import('./jobs'),
    import('./logger'),
  ]);

const logger = createLogger(env);
const database = createDb(env.DATABASE_URL);

const auth = createAuth({ db: database.db, env, logger });
const app = createApp({ env, logger, db: database.db, auth });
const jobs = env.JOBS_ENABLED ? startJobs({ db: database.db, logger }) : null;

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port, env: env.NODE_ENV }, 'api listening');
});

function shutdown(signal: NodeJS.Signals) {
  logger.info({ signal }, 'shutting down');
  void jobs?.stop();
  server.close(() => {
    database.close().finally(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
