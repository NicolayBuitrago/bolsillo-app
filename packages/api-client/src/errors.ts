/** Error returned by the API with the uniform shape of docs/05-api.md. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function isErrorBody(
  value: unknown,
): value is { error: { code: string; message: string; details?: Record<string, unknown> } } {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

/** Builds an `ApiError` from a failed response, tolerating non-JSON bodies. */
export async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  if (isErrorBody(body)) {
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return new ApiError(res.status, 'INTERNAL', `Respuesta inesperada (${res.status})`);
}
