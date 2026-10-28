import { z } from 'zod';
import { ValidationError } from '../errors';

export interface Position {
  occurredAt: Date;
  id: string;
}

const positionSchema = z.tuple([z.iso.datetime(), z.uuid()]);

/** Opaque pagination cursor: base64url of `[occurredAt, id]` (docs/05-api.md). */
export function encodeCursor(position: Position): string {
  return Buffer.from(JSON.stringify([position.occurredAt.toISOString(), position.id])).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string): Position {
  try {
    const [occurredAt, id] = positionSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    return { occurredAt: new Date(occurredAt), id };
  } catch {
    throw new ValidationError('Cursor inválido');
  }
}
