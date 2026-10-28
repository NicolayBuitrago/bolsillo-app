import type { Account, CategoryTreeNode } from '@bolsillo/core/schemas';
import { render, screen, userEvent } from '@testing-library/react-native';
import { transactionStrings as t } from './strings';
import { TransactionFlow } from './transaction-flow';

const NOW = new Date('2026-10-28T20:00:00.000Z');

const account = (id: string, name: string): Account => ({
  id,
  name,
  type: 'digital_wallet',
  institution: null,
  last4: null,
  currency: 'COP',
  initialBalanceMinor: 0,
  creditLimitMinor: null,
  balanceMinor: 0,
  color: null,
  icon: 'wallet',
  archivedAt: null,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
});

const base = { isSystem: false, color: '#f97316', archivedAt: null };
const categories: CategoryTreeNode[] = [
  {
    ...base,
    id: 'food',
    parentId: null,
    name: 'Alimentación',
    kind: 'expense',
    icon: 'food',
    children: [
      {
        ...base,
        id: 'restaurants',
        parentId: 'food',
        name: 'Restaurantes',
        kind: 'expense',
        icon: 'restaurant',
      },
    ],
  },
  {
    ...base,
    id: 'salary',
    parentId: null,
    name: 'Salario',
    kind: 'income',
    icon: 'salary',
    children: [],
  },
];

const accounts = [account('nequi', 'Nequi'), account('bank', 'Banco')];

/** Normalizes the no-break spaces Intl puts in currency output. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

async function typeAmount(user: ReturnType<typeof userEvent.setup>, keys: string[]) {
  for (const key of keys) {
    await user.press(screen.getByRole('button', { name: key }));
  }
}

describe('TransactionFlow', () => {
  it('saves an expense with 3 taps after typing the amount', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    await render(
      <TransactionFlow
        accounts={accounts}
        categories={categories}
        timezone="America/Bogota"
        defaultAccountId="nequi"
        onSave={onSave}
        now={() => NOW}
      />,
    );

    await typeAmount(user, ['4', '5', '9', '0', '0']);
    expect(plain(screen.getByLabelText(/^Monto:/).props.children)).toBe('$ 45.900');

    // 1) Siguiente  2) category  3) Guardar
    await user.press(screen.getByRole('button', { name: t.next }));
    await user.press(screen.getByRole('button', { name: 'Alimentación, Restaurantes' }));
    await user.press(screen.getByRole('button', { name: t.save }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      type: 'expense',
      accountId: 'nequi',
      categoryId: 'restaurants',
      amountMinor: 4_590_000,
      occurredAt: NOW.toISOString(),
      merchant: '',
      note: '',
    });
  });

  it('does not continue without an amount', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    await render(
      <TransactionFlow
        accounts={accounts}
        categories={categories}
        timezone="America/Bogota"
        onSave={onSave}
      />,
    );
    await user.press(screen.getByRole('button', { name: t.next }));
    expect(screen.queryByText(t.chooseCategory)).toBeNull();
  });

  it('shows only income categories for income', async () => {
    const user = userEvent.setup();
    await render(
      <TransactionFlow
        accounts={accounts}
        categories={categories}
        timezone="America/Bogota"
        onSave={jest.fn()}
      />,
    );
    await user.press(screen.getByRole('radio', { name: t.income }));
    await typeAmount(user, ['1']);
    await user.press(screen.getByRole('button', { name: t.next }));
    expect(screen.getByRole('button', { name: 'Salario' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Alimentación' })).toBeNull();
  });

  it('edits an existing transaction starting at the details step', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    await render(
      <TransactionFlow
        accounts={accounts}
        categories={categories}
        timezone="America/Bogota"
        initial={{
          type: 'expense',
          accountId: 'bank',
          categoryId: 'restaurants',
          amountMinor: 1_250_050,
          occurredAt: '2026-10-20T17:30:00.000Z',
          merchant: 'Wok',
          note: '',
        }}
        onSave={onSave}
      />,
    );
    expect(plain(screen.getByLabelText(/^Cambiar monto/).props.accessibilityLabel)).toBe(
      'Cambiar monto: $ 12.500,50',
    );
    await user.press(screen.getByRole('button', { name: t.save }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 1_250_050,
        accountId: 'bank',
        occurredAt: '2026-10-20T17:30:00.000Z',
        merchant: 'Wok',
      }),
    );
  });

  it('rejects a malformed custom date', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();
    await render(
      <TransactionFlow
        accounts={accounts}
        categories={categories}
        timezone="America/Bogota"
        onSave={onSave}
        now={() => NOW}
      />,
    );
    await typeAmount(user, ['1']);
    await user.press(screen.getByRole('button', { name: t.next }));
    await user.press(screen.getByRole('button', { name: t.noCategory }));
    await user.press(screen.getByRole('button', { name: t.otherDay }));
    await user.type(screen.getByLabelText(t.date), '28/10/2026');
    await user.press(screen.getByRole('button', { name: t.save }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(t.invalidDate)).toBeOnTheScreen();
  });
});
