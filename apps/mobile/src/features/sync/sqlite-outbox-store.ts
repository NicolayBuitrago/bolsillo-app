import type { SQLiteDatabase } from 'expo-sqlite';
import type { OutboxEntry, OutboxStore } from './outbox';

interface Row {
  id: string;
  user_id: string;
  payload: string;
  created_at: number;
  attempts: number;
  status: OutboxEntry['status'];
  last_error: string | null;
}

/**
 * Outbox persisted in SQLite so queued transactions survive app restarts.
 * The payload is stored as JSON and only sent to our API.
 */
export function createSqliteOutboxStore(db: SQLiteDatabase): OutboxStore {
  db.execSync(`
    create table if not exists outbox (
      id text primary key not null,
      user_id text not null,
      payload text not null,
      created_at integer not null,
      attempts integer not null default 0,
      status text not null default 'pending',
      last_error text
    );
  `);

  return {
    add(entry) {
      db.runSync(
        `insert or ignore into outbox (id, user_id, payload, created_at, attempts, status, last_error)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.userId,
          JSON.stringify(entry.payload),
          entry.createdAt,
          entry.attempts,
          entry.status,
          entry.lastError,
        ],
      );
    },
    all() {
      return db.getAllSync<Row>('select * from outbox order by created_at, rowid').map((row) => ({
        id: row.id,
        userId: row.user_id,
        payload: JSON.parse(row.payload),
        createdAt: row.created_at,
        attempts: row.attempts,
        status: row.status,
        lastError: row.last_error,
      }));
    },
    update(id, patch) {
      const current = db.getFirstSync<Row>('select * from outbox where id = ?', [id]);
      if (!current) return;
      db.runSync('update outbox set attempts = ?, status = ?, last_error = ? where id = ?', [
        patch.attempts ?? current.attempts,
        patch.status ?? current.status,
        patch.lastError === undefined ? current.last_error : patch.lastError,
        id,
      ]);
    },
    remove(id) {
      db.runSync('delete from outbox where id = ?', [id]);
    },
  };
}
