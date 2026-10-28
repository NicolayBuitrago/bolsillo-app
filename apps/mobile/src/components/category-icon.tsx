import type { IconKey } from '@bolsillo/core/categories';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const ICONS: Record<IconKey, IoniconName> = {
  food: 'fast-food-outline',
  groceries: 'cart-outline',
  restaurant: 'restaurant-outline',
  delivery: 'bicycle-outline',
  transport: 'car-outline',
  fuel: 'speedometer-outline',
  bus: 'bus-outline',
  taxi: 'car-sport-outline',
  car: 'construct-outline',
  home: 'home-outline',
  rent: 'key-outline',
  building: 'business-outline',
  utilities: 'bulb-outline',
  power: 'flash-outline',
  water: 'water-outline',
  gas: 'flame-outline',
  internet: 'wifi-outline',
  phone: 'phone-portrait-outline',
  health: 'medkit-outline',
  entertainment: 'film-outline',
  subscription: 'repeat-outline',
  shopping: 'bag-handle-outline',
  education: 'school-outline',
  pet: 'paw-outline',
  gift: 'gift-outline',
  tax: 'receipt-outline',
  bank: 'library-outline',
  card: 'card-outline',
  cash: 'cash-outline',
  wallet: 'wallet-outline',
  savings: 'save-outline',
  salary: 'briefcase-outline',
  freelance: 'laptop-outline',
  refund: 'return-down-back-outline',
  interest: 'stats-chart-outline',
  income: 'trending-up-outline',
  adjust: 'options-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

const FALLBACK_COLOR = '#64748b';

/** Decorative icon in a tinted circle; always pair it with visible text. */
export function CategoryIcon({
  icon,
  color,
  size = 36,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: number;
}) {
  const tint = color ?? FALLBACK_COLOR;
  const name = (icon && ICONS[icon as IconKey]) || ICONS.other;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${tint}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={size * 0.5} color={tint} />
    </View>
  );
}
