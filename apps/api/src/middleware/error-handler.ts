import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { AppError, ERROR_STATUS, type ErrorBody, type ErrorCode } from '../errors';
import type { Logger } from '../logger';
import type { AppEnv } from '../types';

const STATUS_CODE: Partial<Record<number, ErrorCode>> = Object.fromEntries(
  Object.entries(ERROR_STATUS).map(([code, status]) => [status, code as ErrorCode]),
);

function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ErrorBody = { error: details ? { code, message, details } : { code, message } };
  return c.json(body, status);
}

/** Turns any thrown error into the error shape of docs/05-api.md. */
export function errorHandler(logger: Logger): ErrorHandler<AppEnv> {
  return (err, c) => {
    if (err instanceof AppError) {
      return errorResponse(c, ERROR_STATUS[err.code], err.code, err.message, err.details);
    }
    if (err instanceof ZodError) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'Datos inválidos', {
        issues: err.issues.map(({ path, message, code }) => ({ path, message, code })),
      });
    }
    if (err instanceof HTTPException && err.status < 500) {
      const code = STATUS_CODE[err.status] ?? 'VALIDATION_ERROR';
      return errorResponse(c, err.status, code, err.message || 'Solicitud inválida');
    }
    // Messages may echo user input (merchants, amounts), so only the name and the
    // stack frames are logged; the stack's first line repeats the message.
    const frames = err.stack?.split('\n').slice(1).join('\n');
    logger.error(
      { requestId: c.get('requestId'), err: { name: err.name, stack: frames } },
      'unhandled error',
    );
    return errorResponse(c, 500, 'INTERNAL', 'Error interno');
  };
}

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  errorResponse(c, 404, 'NOT_FOUND', 'Ruta no encontrada');
