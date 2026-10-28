import type { CategoryKind } from '../schemas/categories';
import type { IconKey } from './icons';

export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
  icon: IconKey;
  color: string;
  isSystem?: boolean;
  children?: { name: string; icon: IconKey }[];
}

/** Name of the system category used by balance adjustments (one per kind). */
export const ADJUSTMENT_CATEGORY_NAME = 'Ajuste';

/** Categories created for every new user (docs/03-modelo-de-datos.md). */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    name: 'Alimentación',
    kind: 'expense',
    icon: 'food',
    color: '#f97316',
    children: [
      { name: 'Mercado', icon: 'groceries' },
      { name: 'Restaurantes', icon: 'restaurant' },
      { name: 'Domicilios', icon: 'delivery' },
    ],
  },
  {
    name: 'Transporte',
    kind: 'expense',
    icon: 'transport',
    color: '#3b82f6',
    children: [
      { name: 'Gasolina', icon: 'fuel' },
      { name: 'Transporte público', icon: 'bus' },
      { name: 'Taxi/apps', icon: 'taxi' },
      { name: 'Mantenimiento vehículo', icon: 'car' },
    ],
  },
  {
    name: 'Vivienda',
    kind: 'expense',
    icon: 'home',
    color: '#a855f7',
    children: [
      { name: 'Arriendo', icon: 'rent' },
      { name: 'Administración', icon: 'building' },
    ],
  },
  {
    name: 'Servicios',
    kind: 'expense',
    icon: 'utilities',
    color: '#06b6d4',
    children: [
      { name: 'Energía', icon: 'power' },
      { name: 'Agua', icon: 'water' },
      { name: 'Gas', icon: 'gas' },
      { name: 'Internet', icon: 'internet' },
      { name: 'Celular', icon: 'phone' },
    ],
  },
  { name: 'Salud', kind: 'expense', icon: 'health', color: '#ef4444' },
  { name: 'Entretenimiento', kind: 'expense', icon: 'entertainment', color: '#ec4899' },
  { name: 'Suscripciones', kind: 'expense', icon: 'subscription', color: '#6366f1' },
  { name: 'Compras', kind: 'expense', icon: 'shopping', color: '#f59e0b' },
  { name: 'Educación', kind: 'expense', icon: 'education', color: '#14b8a6' },
  { name: 'Mascotas', kind: 'expense', icon: 'pet', color: '#84cc16' },
  { name: 'Regalos', kind: 'expense', icon: 'gift', color: '#ec4899' },
  { name: 'Impuestos', kind: 'expense', icon: 'tax', color: '#64748b' },
  { name: 'Comisiones bancarias', kind: 'expense', icon: 'bank', color: '#64748b' },
  { name: 'Otros gastos', kind: 'expense', icon: 'other', color: '#64748b' },
  { name: 'Salario', kind: 'income', icon: 'salary', color: '#22c55e' },
  { name: 'Freelance', kind: 'income', icon: 'freelance', color: '#14b8a6' },
  { name: 'Reembolsos', kind: 'income', icon: 'refund', color: '#84cc16' },
  { name: 'Intereses', kind: 'income', icon: 'interest', color: '#06b6d4' },
  { name: 'Otros ingresos', kind: 'income', icon: 'income', color: '#64748b' },
  {
    name: ADJUSTMENT_CATEGORY_NAME,
    kind: 'expense',
    icon: 'adjust',
    color: '#64748b',
    isSystem: true,
  },
  {
    name: ADJUSTMENT_CATEGORY_NAME,
    kind: 'income',
    icon: 'adjust',
    color: '#64748b',
    isSystem: true,
  },
];
