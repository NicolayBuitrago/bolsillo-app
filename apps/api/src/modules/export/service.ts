import { endOfDayInZone, startOfDayInZone, toDateKey, toLocalDateTime } from '@bolsillo/core/dates';
import { toAmountInput } from '@bolsillo/core/money';
import type { exportQuerySchema, TransactionStatus, TransactionType } from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import type { SettingsService } from '../settings/service';
import { exportRows } from './repository';

type ExportQuery = z.infer<typeof exportQuerySchema>;

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer_out: 'Transferencia enviada',
  transfer_in: 'Transferencia recibida',
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
};

const HEADER = [
  'Fecha',
  'Tipo',
  'Estado',
  'Cuenta',
  'Categoría',
  'Comercio',
  'Nota',
  'Monto',
  'Moneda',
];

const SEPARATOR = ';';
/** Excel detects UTF-8 (tildes) only with a byte order mark. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Quotes a text cell when needed. Cells that a spreadsheet would read as a
 * formula (`=`, `+`, `-`, `@`, tab, carriage return) get a leading `'`, since
 * merchants and notes can come from captured notifications.
 */
export function textCell(value: string | null): string {
  if (value === null || value === '') return '';
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Signed amount with a decimal comma and no thousands separator
 * (`-45900`, `45900,50`): Excel in Spanish reads it as a number.
 */
export function amountCell(amountMinor: number, type: TransactionType, currency: 'COP' | 'USD') {
  const outgoing = type === 'expense' || type === 'transfer_out';
  return `${outgoing ? '-' : ''}${toAmountInput(amountMinor, currency)}`;
}

export interface ExportServiceDeps {
  db: Database;
  settings: SettingsService;
}

export function createExportService({ db, settings }: ExportServiceDeps) {
  return {
    /** CSV (UTF-8 with BOM, `;`, CRLF) of the user's transactions; dates in the user zone. */
    async transactionsCsv(
      userId: string,
      query: ExportQuery,
    ): Promise<{ filename: string; body: string }> {
      const { timezone } = await settings.load(userId);
      const rows = await exportRows(db, userId, {
        ...(query.from ? { start: startOfDayInZone(query.from, timezone) } : {}),
        ...(query.to ? { end: endOfDayInZone(query.to, timezone) } : {}),
      });
      const lines = [HEADER.join(SEPARATOR)];
      for (const row of rows) {
        const category = row.parentName
          ? `${row.parentName} / ${row.categoryName}`
          : row.categoryName;
        lines.push(
          [
            toLocalDateTime(row.occurredAt, timezone).replace('T', ' '),
            TYPE_LABELS[row.type],
            STATUS_LABELS[row.status],
            textCell(row.accountName),
            textCell(category),
            textCell(row.merchant),
            textCell(row.note),
            amountCell(row.amountMinor, row.type, row.currency),
            row.currency,
          ].join(SEPARATOR),
        );
      }
      return {
        filename: `bolsillo-movimientos-${toDateKey(new Date(), timezone)}.csv`,
        body: `${BOM}${lines.join('\r\n')}\r\n`,
      };
    },
  };
}

export type ExportService = ReturnType<typeof createExportService>;
