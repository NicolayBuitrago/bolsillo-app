import { ApiError } from '@bolsillo/api-client';

/** Message to show to the user for a failed mutation. API messages are already in Spanish. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.';
}
