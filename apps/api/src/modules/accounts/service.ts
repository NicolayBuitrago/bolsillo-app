import { newId } from '@bolsillo/core/ids';
import type {
  Account,
  AccountType,
  adjustBalanceSchema,
  createAccountSchema,
  Transaction,
  updateAccountSchema,
} from '@bolsillo/core/schemas';
import type { Database } from '@bolsillo/db';
import type { z } from 'zod';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../errors';
import { isUniqueViolation } from '../../lib/pg-errors';
import type { CategoriesService } from '../categories/service';
import type { SettingsService } from '../settings/service';
import { toTransaction } from '../transactions/dto';
import { insertTransaction } from '../transactions/repository';
import {
  type AccountWithBalance,
  findAccount,
  insertAccount,
  listAccounts,
  updateAccount,
} from './repository';

type CreateAccount = z.infer<typeof createAccountSchema>;
type UpdateAccount = z.infer<typeof updateAccountSchema>;
type AdjustBalance = z.infer<typeof adjustBalanceSchema>;

const ACTIVE_NAME_KEY = 'financial_accounts_user_id_name_active_key';

export function toAccount(row: AccountWithBalance): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution,
    last4: row.last4,
    currency: row.currency,
    initialBalanceMinor: row.initialBalanceMinor,
    creditLimitMinor: row.creditLimitMinor,
    balanceMinor: row.balanceMinor,
    color: row.color,
    icon: row.icon,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertCreditLimit(type: AccountType, creditLimitMinor: number | null | undefined) {
  if (type !== 'credit_card' && creditLimitMinor != null) {
    throw new BusinessRuleError('El cupo solo aplica a tarjetas de crédito');
  }
}

async function withUniqueName<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolation(error, ACTIVE_NAME_KEY)) {
      throw new ConflictError('Ya existe una cuenta activa con ese nombre');
    }
    throw error;
  }
}

export interface AccountsServiceDeps {
  db: Database;
  settings: SettingsService;
  categories: CategoriesService;
}

export function createAccountsService({ db, settings, categories }: AccountsServiceDeps) {
  async function requireAccount(userId: string, id: string): Promise<AccountWithBalance> {
    const account = await findAccount(db, userId, id);
    if (!account) throw new NotFoundError('Cuenta no encontrada');
    return account;
  }

  return {
    async list(userId: string, includeArchived: boolean): Promise<Account[]> {
      return (await listAccounts(db, userId, includeArchived)).map(toAccount);
    },

    /** An active account of the user that transactions can use. */
    async assertUsable(userId: string, id: string): Promise<AccountWithBalance> {
      const account = await requireAccount(userId, id);
      if (account.archivedAt) throw new BusinessRuleError('La cuenta está archivada');
      return account;
    },

    async create(userId: string, input: CreateAccount): Promise<Account> {
      assertCreditLimit(input.type, input.creditLimitMinor);
      const currency = input.currency ?? (await settings.load(userId)).defaultCurrency;
      const row = await withUniqueName(() => insertAccount(db, userId, { ...input, currency }));
      if (!row) throw new Error('Account insert returned no row');
      return toAccount({ ...row, balanceMinor: row.initialBalanceMinor });
    },

    async update(userId: string, id: string, input: UpdateAccount): Promise<Account> {
      const current = await requireAccount(userId, id);
      if (current.archivedAt) throw new BusinessRuleError('La cuenta está archivada');
      const type = input.type ?? current.type;
      assertCreditLimit(type, input.creditLimitMinor);
      // Leaving the credit card type drops its credit limit.
      const patch = type === 'credit_card' ? input : { ...input, creditLimitMinor: null };
      await withUniqueName(() => updateAccount(db, userId, id, patch));
      return toAccount(await requireAccount(userId, id));
    },

    async archive(userId: string, id: string): Promise<Account> {
      const current = await requireAccount(userId, id);
      if (!current.archivedAt) {
        await updateAccount(db, userId, id, { archivedAt: new Date() });
      }
      return toAccount(await requireAccount(userId, id));
    },

    /**
     * Records a confirmed "Ajuste" transaction for the difference between the
     * real balance and the calculated one. No transaction when they match.
     */
    async adjustBalance(
      userId: string,
      id: string,
      input: AdjustBalance,
    ): Promise<{ account: Account; transaction: Transaction | null }> {
      const account = await requireAccount(userId, id);
      if (account.archivedAt) throw new BusinessRuleError('La cuenta está archivada');
      const difference = input.actualBalanceMinor - account.balanceMinor;
      if (difference === 0) {
        return { account: toAccount(account), transaction: null };
      }
      const kind = difference > 0 ? 'income' : 'expense';
      const category = await categories.adjustmentCategory(userId, kind);
      const now = new Date();
      const row = await insertTransaction(db, userId, {
        id: newId(),
        accountId: account.id,
        categoryId: category.id,
        type: kind,
        status: 'confirmed',
        source: 'manual',
        amountMinor: Math.abs(difference),
        currency: account.currency,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : now,
        confirmedAt: now,
      });
      if (!row) throw new Error('Adjustment insert returned no row');
      return {
        account: toAccount(await requireAccount(userId, id)),
        transaction: toTransaction(row),
      };
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
