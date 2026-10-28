import { v7 } from 'uuid';

/**
 * Time-ordered UUID v7. Clients use it for records they create (transactions,
 * transfers) so retries are idempotent. Needs `crypto.getRandomValues`.
 */
export function newId(): string {
  return v7();
}
