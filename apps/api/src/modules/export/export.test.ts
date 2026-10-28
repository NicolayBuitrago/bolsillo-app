import { newId } from '@bolsillo/core/ids';
import type { TrendReport } from '@bolsillo/core/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { categoryId, createAccount, createTransaction } from '../../test/fixtures';
import { createTestContext, json, signUp, type TestUser } from '../../test/helpers';
import { amountCell, textCell } from './service';

let ctx: Awaited<ReturnType<typeof createTestContext>>;
let user: TestUser;

beforeAll(async () => {
  ctx = await createTestContext();
  user = await signUp(ctx.app);
});

afterAll(async () => {
  await ctx.destroy();
});

describe('GET /v1/export/transactions.csv', () => {
  it('exports UTF-8 with BOM, ; separators and Excel-friendly amounts', async () => {
    const account = await createAccount(user, { name: 'Bancolombia Ahorros' });
    const groceries = await categoryId(user, 'Mercado');
    const salary = await categoryId(user, 'Salario', 'income');
    await createTransaction(user, account.id, {
      categoryId: groceries,
      amountMinor: 4_590_000,
      occurredAt: '2026-10-15T17:30:00Z',
      merchant: 'Éxito; Calle 80',
      note: 'Compra "grande"',
    });
    await createTransaction(user, account.id, {
      type: 'income',
      categoryId: salary,
      amountMinor: 420_000_050,
      occurredAt: '2026-10-01T13:00:00Z',
    });
    const deleted = await createTransaction(user, account.id, {
      occurredAt: '2026-10-02T13:00:00Z',
    });
    await user.delete(`/v1/transactions/${deleted.id}`);

    const res = await user.get('/v1/export/transactions.csv?from=2026-10-01&to=2026-10-31');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="bolsillo-movimientos-\d{4}-\d{2}-\d{2}\.csv"$/,
    );

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8').decode(bytes.slice(3));
    expect(text.split('\r\n')).toEqual([
      'Fecha;Tipo;Estado;Cuenta;Categoría;Comercio;Nota;Monto;Moneda',
      '2026-10-01 08:00;Ingreso;Confirmado;Bancolombia Ahorros;Salario;;;4200000,50;COP',
      '2026-10-15 12:30;Gasto;Confirmado;Bancolombia Ahorros;Alimentación / Mercado;"Éxito; Calle 80";"Compra ""grande""";-45900;COP',
      '',
    ]);
  });

  it('only exports the signed-in user data and validates dates', async () => {
    const other = await signUp(ctx.app);
    const res = await other.get('/v1/export/transactions.csv');
    const text = new TextDecoder().decode((await res.arrayBuffer()).slice(3));
    expect(text).toBe('Fecha;Tipo;Estado;Cuenta;Categoría;Comercio;Nota;Monto;Moneda\r\n');
    expect((await other.get('/v1/export/transactions.csv?from=2026-13-01')).status).toBe(400);
  });
});

describe('csv cells', () => {
  it('neutralizes spreadsheet formulas in text', () => {
    expect(textCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(textCell('+57 300')).toBe("'+57 300");
    expect(textCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(textCell('Rappi')).toBe('Rappi');
    expect(textCell(null)).toBe('');
  });

  it('signs outgoing amounts', () => {
    expect(amountCell(4_590_000, 'expense', 'COP')).toBe('-45900');
    expect(amountCell(150_00, 'transfer_out', 'COP')).toBe('-150');
    expect(amountCell(150_05, 'transfer_in', 'USD')).toBe('150,05');
  });
});

describe('GET /v1/reports/trend', () => {
  it('returns every month up to the current one with income and expenses', async () => {
    const other = await signUp(ctx.app);
    const account = await createAccount(other);
    const now = new Date();
    await createTransaction(other, account.id, {
      amountMinor: 100_00,
      occurredAt: now.toISOString(),
    });
    await createTransaction(other, account.id, {
      type: 'income',
      amountMinor: 300_00,
      occurredAt: now.toISOString(),
    });
    await other.post('/v1/transfers', {
      id: newId(),
      fromAccountId: account.id,
      toAccountId: (await createAccount(other)).id,
      amountMinor: 999_00,
      occurredAt: now.toISOString(),
    });

    const trend = await json<TrendReport>(await other.get('/v1/reports/trend?months=3'));
    expect(trend.months).toHaveLength(3);
    expect(trend.months[0]?.totals).toEqual([]);
    expect(trend.months[2]?.totals).toEqual([
      { currency: 'COP', incomeMinor: 300_00, expenseMinor: 100_00, netMinor: 200_00 },
    ]);
    const months = trend.months.map((item) => item.month);
    expect([...months].sort()).toEqual(months);
    expect((await json<TrendReport>(await other.get('/v1/reports/trend'))).months).toHaveLength(6);
    expect((await other.get('/v1/reports/trend?months=0')).status).toBe(400);
  });
});
