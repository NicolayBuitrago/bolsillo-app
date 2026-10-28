import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  type AppError,
  BusinessRuleError,
  ConflictError,
  type ErrorBody,
  ForbiddenError,
  NotFoundError,
  RateLimitedError,
  UnauthenticatedError,
  ValidationError,
} from '../errors';
import { createMemoryLogger } from '../test/helpers';
import type { AppEnv } from '../types';
import { errorHandler } from './error-handler';

function appThrowing(error: unknown) {
  const { logger, lines } = createMemoryLogger();
  const app = new Hono<AppEnv>().use(requestId()).get('/boom', () => {
    throw error;
  });
  app.onError(errorHandler(logger));
  return { app, logs: lines };
}

async function readError(res: Response): Promise<ErrorBody['error']> {
  return ((await res.json()) as ErrorBody).error;
}

describe('errorHandler', () => {
  it.each<[AppError, number, string]>([
    [new ValidationError('Monto inválido', { field: 'amountMinor' }), 400, 'VALIDATION_ERROR'],
    [new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError(), 404, 'NOT_FOUND'],
    [new ConflictError(), 409, 'CONFLICT'],
    [new BusinessRuleError('No se puede archivar una categoría de sistema'), 422, 'BUSINESS_RULE'],
    [new RateLimitedError(), 429, 'RATE_LIMITED'],
  ])('maps %s to its status and code', async (error, status, code) => {
    const { app } = appThrowing(error);
    const res = await app.request('/boom');
    expect(res.status).toBe(status);
    const body = await readError(res);
    expect(body.code).toBe(code);
    expect(body.message).toBe(error.message);
  });

  it('includes details when present', async () => {
    const { app } = appThrowing(new ValidationError('Monto inválido', { field: 'amountMinor' }));
    const body = await readError(await app.request('/boom'));
    expect(body.details).toEqual({ field: 'amountMinor' });
  });

  it('maps Zod errors to VALIDATION_ERROR with issues', async () => {
    const parsed = z.object({ amountMinor: z.number() }).safeParse({ amountMinor: 'x' });
    const { app } = appThrowing(parsed.error);
    const res = await app.request('/boom');
    expect(res.status).toBe(400);
    const body = await readError(res);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toMatchObject({ issues: [{ path: ['amountMinor'] }] });
  });

  it('maps client HTTPExceptions by status', async () => {
    const { app } = appThrowing(new HTTPException(401, { message: 'no session' }));
    const res = await app.request('/boom');
    expect(res.status).toBe(401);
    expect((await readError(res)).code).toBe('UNAUTHENTICATED');
  });

  it('falls back to VALIDATION_ERROR for unmapped 4xx HTTPExceptions', async () => {
    const { app } = appThrowing(new HTTPException(413));
    const res = await app.request('/boom');
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Solicitud inválida' },
    });
  });

  it('hides unexpected errors and logs them without their message', async () => {
    const { app, logs } = appThrowing(new Error('merchant EXITO 45900'));
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Error interno' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ msg: 'unhandled error', err: { name: 'Error' } });
    expect(JSON.stringify(logs)).not.toMatch(/EXITO|45900/);
  });
});
