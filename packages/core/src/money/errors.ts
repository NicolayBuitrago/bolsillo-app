export type MoneyErrorCode =
  | 'INVALID_FORMAT'
  | 'EMPTY_INPUT'
  | 'NEGATIVE_AMOUNT'
  | 'TOO_MANY_DECIMALS'
  | 'UNSUPPORTED_CURRENCY'
  | 'CURRENCY_MISMATCH'
  | 'UNSAFE_INTEGER';

/** Typed error for every failure in the money module. */
export class MoneyError extends Error {
  override readonly name: string = 'MoneyError';

  constructor(
    readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Raised by `parseAmount` when a text cannot be read as an amount. */
export class AmountParseError extends MoneyError {
  override readonly name = 'AmountParseError';
}
