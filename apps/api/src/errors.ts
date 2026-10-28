import type { ContentfulStatusCode } from 'hono/utils/http-status';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export const ERROR_STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Body shape of every error response (docs/05-api.md). */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Base class for errors raised by services; the error middleware turns them into responses. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Se requiere iniciar sesión') {
    super('UNAUTHENTICATED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Permisos insuficientes') {
    super('FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super('NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe con datos distintos') {
    super('CONFLICT', message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BUSINESS_RULE', message, details);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Demasiadas solicitudes, intenta más tarde') {
    super('RATE_LIMITED', message);
  }
}
