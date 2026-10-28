import { endOfDayInZone, startOfDayInZone, toDateKey } from '@bolsillo/core/dates';
import { newId } from '@bolsillo/core/ids';
import { toMinor } from '@bolsillo/core/money';
import { addDays, nextDueAfter } from '@bolsillo/core/recurring';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { Database } from './client';
import { ensureUserDefaults } from './defaults';
import {
  account,
  budgets,
  categories,
  financialAccounts,
  recurringPayments,
  transactions,
  user,
} from './schema';

export const DEMO_EMAIL = 'demo@bolsillo.local';
const TIME_ZONE = 'America/Bogota';
const DAYS = 92;

export interface SeedOptions {
  /** Password of the demo user (`SEED_DEMO_PASSWORD`). */
  password: string;
  /** Reference "today"; the history ends here. */
  now?: Date;
}

export interface SeedResult {
  email: string;
  accounts: number;
  transactions: number;
  transfers: number;
  budgets: number;
  recurringPayments: number;
}

type TransactionValues = typeof transactions.$inferInsert;

/** Small deterministic PRNG (mulberry32) so every seed produces the same data. */
function random(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    /** Whole pesos between min and max, rounded to $100. */
    pesos: (min: number, max: number) => Math.round((min + next() * (max - min)) / 100) * 100,
  };
}

const cop = (pesos: number) => toMinor(pesos, 'COP');

/** Everyday spending templates (fake demo data). */
const DAILY = [
  {
    category: 'Mercado',
    merchants: ['Éxito', 'Carulla', 'D1', 'Ara', 'Olímpica'],
    min: 15_000,
    max: 220_000,
    weight: 3,
  },
  {
    category: 'Restaurantes',
    merchants: ['Crepes & Waffles', 'El Corral', 'Wok', 'Corrientazo La 45'],
    min: 18_000,
    max: 95_000,
    weight: 3,
  },
  {
    category: 'Domicilios',
    merchants: ['Rappi', 'iFood', 'DiDi Food'],
    min: 25_000,
    max: 70_000,
    weight: 2,
  },
  {
    category: 'Taxi/apps',
    merchants: ['Uber', 'DiDi', 'Cabify'],
    min: 9_000,
    max: 38_000,
    weight: 2,
  },
  {
    category: 'Transporte público',
    merchants: ['Recarga TuLlave'],
    min: 10_000,
    max: 30_000,
    weight: 2,
  },
  { category: 'Gasolina', merchants: ['Terpel', 'Primax'], min: 60_000, max: 160_000, weight: 1 },
  {
    category: 'Entretenimiento',
    merchants: ['Cine Colombia', 'Procinal', 'Teatro Colsubsidio'],
    min: 20_000,
    max: 90_000,
    weight: 1,
  },
  {
    category: 'Salud',
    merchants: ['Farmatodo', 'Cruz Verde'],
    min: 12_000,
    max: 120_000,
    weight: 1,
  },
  {
    category: 'Compras',
    merchants: ['Falabella', 'Mercado Libre', 'Tienda D1'],
    min: 30_000,
    max: 350_000,
    weight: 1,
  },
] as const;

const WEIGHTED = DAILY.flatMap((template) =>
  Array<typeof template>(template.weight).fill(template),
);

/** Fixed monthly payments: [day of month, category, merchant, pesos, account key]. */
const MONTHLY = [
  [1, 'Salario', 'Empresa Demo S.A.S.', 4_200_000, 'bank', 'income'],
  [5, 'Arriendo', 'Arrendamientos Demo', 1_800_000, 'bank', 'expense'],
  [5, 'Administración', 'Conjunto Demo', 280_000, 'bank', 'expense'],
  [8, 'Internet', 'Claro', 95_000, 'card', 'expense'],
  [10, 'Energía', 'Enel', 118_000, 'bank', 'expense'],
  [12, 'Agua', 'Acueducto', 64_000, 'bank', 'expense'],
  [12, 'Celular', 'Movistar', 52_000, 'card', 'expense'],
  [15, 'Suscripciones', 'Netflix', 38_900, 'card', 'expense'],
  [16, 'Freelance', 'Cliente freelance', 1_100_000, 'bank', 'income'],
  [20, 'Suscripciones', 'Spotify', 16_900, 'card', 'expense'],
] as const;

/**
 * Development seed (docs/03-modelo-de-datos.md): the demo user, four accounts
 * and ~3 months of varied transactions and transfers. Re-running it replaces
 * the demo user and everything it owns.
 */
export async function seed(db: Database, options: SeedOptions): Promise<SeedResult> {
  const now = options.now ?? new Date();
  const rng = random(20_261_028);

  await db.delete(user).where(eq(user.email, DEMO_EMAIL));
  const [demo] = await db
    .insert(user)
    .values({ name: 'Usuario Demo', email: DEMO_EMAIL, emailVerified: true })
    .returning();
  if (!demo) throw new Error('Demo user not created');
  await db.insert(account).values({
    userId: demo.id,
    providerId: 'credential',
    accountId: demo.id,
    password: await hashPassword(options.password),
  });
  await ensureUserDefaults(db, demo.id);

  const accountRows = await db
    .insert(financialAccounts)
    .values([
      {
        userId: demo.id,
        name: 'Bancolombia Ahorros',
        type: 'savings',
        institution: 'Bancolombia',
        last4: '4321',
        initialBalanceMinor: cop(3_500_000),
        color: '#f59e0b',
        icon: 'savings',
      },
      {
        userId: demo.id,
        name: 'Nequi',
        type: 'digital_wallet',
        institution: 'Nequi',
        initialBalanceMinor: cop(150_000),
        color: '#a855f7',
        icon: 'wallet',
      },
      {
        userId: demo.id,
        name: 'Efectivo',
        type: 'cash',
        initialBalanceMinor: cop(80_000),
        color: '#22c55e',
        icon: 'cash',
      },
      {
        userId: demo.id,
        name: 'Visa Bancolombia',
        type: 'credit_card',
        institution: 'Bancolombia',
        last4: '9876',
        creditLimitMinor: cop(6_000_000),
        color: '#3b82f6',
        icon: 'card',
      },
    ])
    .returning();
  const [bank, nequi, cash, card] = accountRows;
  if (!bank || !nequi || !cash || !card) throw new Error('Demo accounts not created');
  const accountsByKey = { bank, nequi, cash, card };

  const categoryRows = await db.select().from(categories).where(eq(categories.userId, demo.id));
  const categoryId = (name: string, kind: 'expense' | 'income' = 'expense') => {
    const row = categoryRows.find((item) => item.name === name && item.kind === kind);
    if (!row) throw new Error(`Default category missing: ${name}`);
    return row.id;
  };

  const today = toDateKey(now, TIME_ZONE);
  /** Local instant `daysAgo` days before today at `hour` (Bogotá). */
  const at = (daysAgo: number, hour: number, minute = 0) => {
    const start = startOfDayInZone(today, TIME_ZONE).getTime() - daysAgo * 86_400_000;
    return new Date(start + (hour * 60 + minute) * 60_000);
  };
  const confirmedAt = now;
  const rows: TransactionValues[] = [];
  const entry = (
    values: Omit<
      TransactionValues,
      'id' | 'userId' | 'status' | 'source' | 'currency' | 'confirmedAt'
    >,
  ) =>
    rows.push({
      id: newId(),
      userId: demo.id,
      status: 'confirmed',
      source: 'manual',
      currency: 'COP',
      confirmedAt,
      ...values,
    });
  let transfers = 0;
  const transfer = (from: string, to: string, pesos: number, occurredAt: Date, note: string) => {
    const transferGroupId = newId();
    const shared = {
      userId: demo.id,
      status: 'confirmed',
      source: 'manual',
      currency: 'COP',
      confirmedAt,
      amountMinor: cop(pesos),
      occurredAt,
      note,
      transferGroupId,
    } as const;
    rows.push({ ...shared, id: newId(), type: 'transfer_out', accountId: from });
    rows.push({ ...shared, id: newId(), type: 'transfer_in', accountId: to });
    transfers += 1;
  };

  for (let daysAgo = DAYS; daysAgo >= 0; daysAgo -= 1) {
    const occurred = at(daysAgo, 12);
    if (occurred > now) continue;
    const dayOfMonth = Number(toDateKey(occurred, TIME_ZONE).slice(8, 10));

    for (const [day, category, merchant, pesos, accountKey, kind] of MONTHLY) {
      if (day !== dayOfMonth) continue;
      entry({
        type: kind,
        accountId: accountsByKey[accountKey].id,
        categoryId: categoryId(category, kind),
        amountMinor: cop(pesos),
        occurredAt: at(daysAgo, 8, 30),
        merchant,
      });
    }

    const count = Math.floor(rng.next() * 3);
    for (let index = 0; index < count; index += 1) {
      const template = rng.pick(WEIGHTED);
      const amountMinor = cop(rng.pesos(template.min, template.max));
      // Small purchases sometimes in cash; public transport is always Nequi.
      const accountRow =
        template.category === 'Transporte público'
          ? nequi
          : amountMinor < cop(40_000) && rng.next() < 0.5
            ? cash
            : rng.pick([bank, bank, card, card, card, nequi]);
      const occurredAt = at(daysAgo, 7 + Math.floor(rng.next() * 14), Math.floor(rng.next() * 60));
      if (occurredAt > now) continue;
      entry({
        type: 'expense',
        accountId: accountRow.id,
        categoryId: categoryId(template.category),
        amountMinor,
        occurredAt,
        merchant: rng.pick(template.merchants),
        ...(rng.next() < 0.15 ? { note: 'Con la familia' } : {}),
      });
    }

    if (daysAgo % 7 === 3) transfer(bank.id, nequi.id, 150_000, at(daysAgo, 9), 'Recarga Nequi');
    if (dayOfMonth === 25) transfer(bank.id, card.id, 1_000_000, at(daysAgo, 10), 'Pago tarjeta');
    if (daysAgo % 14 === 5) transfer(bank.id, cash.id, 100_000, at(daysAgo, 18), 'Retiro cajero');
  }

  // One uncategorized expense today, still inside the current day.
  const latest = new Date(Math.min(now.getTime(), endOfDayInZone(today, TIME_ZONE).getTime() - 1));
  entry({
    type: 'expense',
    accountId: cash.id,
    amountMinor: cop(6_500),
    occurredAt: latest,
    merchant: 'Tienda de barrio',
  });

  await db.transaction(async (tx) => {
    for (let index = 0; index < rows.length; index += 200) {
      await tx.insert(transactions).values(rows.slice(index, index + 200));
    }
  });

  // Budgets from the first seeded month; recurring payments anchored then too.
  const firstMonthStart = `${toDateKey(at(DAYS, 12), TIME_ZONE).slice(0, 7)}-01`;
  const budgetRows = await db
    .insert(budgets)
    .values([
      {
        userId: demo.id,
        categoryId: categoryId('Alimentación'),
        amountMinor: cop(1_500_000),
        currency: 'COP',
        startsOn: firstMonthStart,
      },
      {
        userId: demo.id,
        categoryId: categoryId('Transporte'),
        amountMinor: cop(450_000),
        currency: 'COP',
        startsOn: firstMonthStart,
      },
    ])
    .returning();

  const recurring = (day: number) => {
    const anchorOn = `${firstMonthStart.slice(0, 8)}${String(day).padStart(2, '0')}`;
    return { anchorOn, nextDueOn: nextDueAfter(anchorOn, 'monthly', addDays(today, -1)) };
  };
  const recurringRows = await db
    .insert(recurringPayments)
    .values([
      {
        userId: demo.id,
        name: 'Arriendo',
        accountId: bank.id,
        categoryId: categoryId('Arriendo'),
        amountMinor: cop(1_800_000),
        currency: 'COP',
        frequency: 'monthly',
        autoCreate: true,
        remindDaysBefore: 3,
        ...recurring(5),
      },
      {
        userId: demo.id,
        name: 'Netflix',
        accountId: card.id,
        categoryId: categoryId('Suscripciones'),
        amountMinor: cop(38_900),
        currency: 'COP',
        frequency: 'monthly',
        ...recurring(15),
      },
      {
        userId: demo.id,
        name: 'Energía',
        accountId: bank.id,
        categoryId: categoryId('Energía'),
        amountMinor: null,
        currency: 'COP',
        frequency: 'monthly',
        ...recurring(10),
      },
    ])
    .returning();

  return {
    email: DEMO_EMAIL,
    accounts: accountRows.length,
    transactions: rows.length,
    transfers,
    budgets: budgetRows.length,
    recurringPayments: recurringRows.length,
  };
}
