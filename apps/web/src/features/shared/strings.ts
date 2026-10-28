import type { IconKey } from '@bolsillo/core/categories';
import type {
  AccountType,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '@bolsillo/core/schemas';

export const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Cuenta bancaria',
  credit_card: 'Tarjeta de crédito',
  cash: 'Efectivo',
  digital_wallet: 'Billetera digital',
  savings: 'Ahorros',
  other: 'Otra',
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  expense: 'Gasto',
  income: 'Ingreso',
  transfer_out: 'Transferencia enviada',
  transfer_in: 'Transferencia recibida',
};

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
};

export const transactionSourceLabels: Record<TransactionSource, string> = {
  manual: 'Manual',
  notification: 'Notificación',
  email: 'Correo',
  shortcut: 'Atajo de iOS',
  recurring: 'Recurrente',
  import: 'Importado',
};

export const iconLabels: Record<IconKey, string> = {
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

export const commonStrings = {
  save: 'Guardar',
  saving: 'Guardando…',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  edit: 'Editar',
  archive: 'Archivar',
  retry: 'Reintentar',
  loadError: 'No se pudieron cargar los datos.',
  noCategory: 'Sin categoría',
  optional: 'opcional',
  loadMore: 'Cargar más',
  actions: 'Acciones',
} as const;
