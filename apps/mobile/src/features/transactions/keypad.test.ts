import { formatKeypadDisplay, type KeypadKey, keypadAmountMinor, pressKey } from './keypad';

const type = (keys: KeypadKey[], start = '') =>
  keys.reduce((text, key) => pressKey(text, key), start);
/** Intl may use no-break spaces. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('keypad', () => {
  it('builds amounts from digits, 000 and decimals', () => {
    expect(type(['4', '5', '9', '000'])).toBe('459000');
    expect(type(['4', '5', '9', '0', '0', ',', '5', '0'])).toBe('45900,50');
    expect(type([',', '5'])).toBe('0,5');
  });

  it('ignores invalid presses', () => {
    expect(type(['0', '0', '000'])).toBe('0');
    expect(type(['1', ',', '2', '3', '4'])).toBe('1,23');
    expect(type(['1', ',', ','])).toBe('1,');
    expect(type(Array(13).fill('9') as KeypadKey[])).toBe('999999999999');
  });

  it('deletes with back', () => {
    expect(type(['4', '5', 'back'])).toBe('4');
    expect(type(['back'])).toBe('');
  });

  it('converts to minor units with core money rules', () => {
    expect(keypadAmountMinor('45900')).toBe(4_590_000);
    expect(keypadAmountMinor('45900,5')).toBe(4_590_050);
    expect(keypadAmountMinor('45900,')).toBe(4_590_000);
    expect(keypadAmountMinor('')).toBe(0);
  });

  it('displays the amount in es-CO format while typing', () => {
    expect(plain(formatKeypadDisplay(''))).toBe('$ 0');
    expect(plain(formatKeypadDisplay('45900'))).toBe('$ 45.900');
    expect(plain(formatKeypadDisplay('1234567'))).toBe('$ 1.234.567');
    expect(plain(formatKeypadDisplay('45900,5'))).toBe('$ 45.900,5');
  });
});
