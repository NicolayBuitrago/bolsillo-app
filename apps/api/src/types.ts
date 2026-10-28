import type { RequestIdVariables } from 'hono/request-id';

/** Hono environment shared by every route and middleware. */
export interface AppEnv {
  Variables: RequestIdVariables;
}
