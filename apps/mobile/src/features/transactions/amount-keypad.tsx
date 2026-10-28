import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import type { KeypadKey } from './keypad';
import { transactionStrings as t } from './strings';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', 'back'],
];

/** Large numeric keypad: the amount is typed first, without the system keyboard. */
export function AmountKeypad({ onPress }: { onPress: (key: KeypadKey) => void }) {
  return (
    <View className="gap-2">
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-2">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={
                key === 'back' ? t.keypadDelete : key === ',' ? t.keypadDecimal : key
              }
              onPress={() => onPress(key)}
              onLongPress={key === '0' ? () => onPress('000') : undefined}
              className="h-16 flex-1 items-center justify-center rounded-xl bg-muted active:opacity-70"
            >
              {key === 'back' ? (
                <Ionicons name="backspace-outline" size={26} color="#64748b" />
              ) : (
                <Text className="text-2xl font-semibold text-foreground">{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
