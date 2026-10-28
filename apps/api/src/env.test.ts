import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgres://bolsillo:bolsillo@localhost:5433/bolsillo',
  WEB_ORIGIN: 'http://localhost:3100',
};

describe('loadEnv', () => {
  it('applies defaults for optional variables', () => {
    expect(loadEnv(validEnv)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DEDUP_WINDOW_MINUTES: 15,
      LLM_DAILY_LIMIT_PER_USER: 50,
    });
  });

  it('coerces numbers and treats empty optional values as missing', () => {
    const env = loadEnv({ ...validEnv, PORT: '8080', ANTHROPIC_API_KEY: '' });
    expect(env.PORT).toBe(8080);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it.each(['DATABASE_URL', 'WEB_ORIGIN'])('fails when %s is missing', (name) => {
    const env: Record<string, string> = { ...validEnv };
    delete env[name];
    expect(() => loadEnv(env)).toThrow(EnvValidationError);
    expect(() => loadEnv(env)).toThrow(name);
  });

  it('rejects invalid values without echoing them', () => {
    let message = '';
    try {
      loadEnv({ ...validEnv, DATABASE_URL: 'mysql://root:hunter2@db/x', PORT: 'abc' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).not.toContain('hunter2');
  });

  it('requires a long auth secret when one is provided', () => {
    expect(() => loadEnv({ ...validEnv, BETTER_AUTH_SECRET: 'short' })).toThrow(
      'BETTER_AUTH_SECRET',
    );
  });
});

describe('API process', () => {
  it('refuses to start when a required variable is missing', () => {
    const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WEB_ORIGIN: 'http://x.y' },
      encoding: 'utf8',
      timeout: 20_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL');
  });
});
