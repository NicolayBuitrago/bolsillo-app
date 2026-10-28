import { ICON_KEYS, type IconKey, PALETTE } from '@bolsillo/core/categories';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { ICONS } from './category-icon';

export const ICON_LABELS: Record<IconKey, string> = {
  food: 'Comida',
  groceries: 'Mercado',
  restaurant: 'Restaurante',
  delivery: 'Domicilio',
  transport: 'Transporte',
  fuel: 'Gasolina',
  bus: 'Bus',
  taxi: 'Taxi',
  car: 'Vehículo',
  home: 'Hogar',
  rent: 'Arriendo',
  building: 'Edificio',
  utilities: 'Servicios',
  power: 'Energía',
  water: 'Agua',
  gas: 'Gas',
  internet: 'Internet',
  phone: 'Celular',
  health: 'Salud',
  entertainment: 'Entretenimiento',
  subscription: 'Suscripción',
  shopping: 'Compras',
  education: 'Educación',
  pet: 'Mascota',
  gift: 'Regalo',
  tax: 'Impuestos',
  bank: 'Banco',
  card: 'Tarjeta',
  cash: 'Efectivo',
  wallet: 'Billetera',
  savings: 'Ahorro',
  salary: 'Salario',
  freelance: 'Freelance',
  refund: 'Reembolso',
  interest: 'Intereses',
  income: 'Ingreso',
  adjust: 'Ajuste',
  other: 'Otro',
};

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Color</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {PALETTE.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityLabel={color}
            accessibilityState={{ checked: value === color }}
            onPress={() => onChange(color)}
            className="size-11 items-center justify-center rounded-full"
            style={{ backgroundColor: color }}
          >
            {value === color ? <Ionicons name="checkmark" size={20} color="#ffffff" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: IconKey;
  color: string;
  onChange: (icon: IconKey) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Ícono</Text>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {ICON_KEYS.map((key) => {
          const selected = value === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={ICON_LABELS[key]}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(key)}
              className={`size-11 items-center justify-center rounded-lg border ${selected ? 'border-transparent' : 'border-border'}`}
              style={selected ? { backgroundColor: `${color}22` } : undefined}
            >
              <Ionicons name={ICONS[key]} size={20} color={selected ? color : '#64748b'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
