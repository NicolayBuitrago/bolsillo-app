import type { IconKey } from '@bolsillo/core/categories';
import {
  Banknote,
  Bike,
  Briefcase,
  Building2,
  Bus,
  Car,
  CarTaxiFront,
  CircleEllipsis,
  Clapperboard,
  CreditCard,
  Droplet,
  Flame,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  Laptop,
  Lightbulb,
  type LucideIcon,
  PawPrint,
  Percent,
  PiggyBank,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  TrendingUp,
  Undo2,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const ICONS: Record<IconKey, LucideIcon> = {
  food: Utensils,
  groceries: ShoppingCart,
  restaurant: UtensilsCrossed,
  delivery: Bike,
  transport: Car,
  fuel: Fuel,
  bus: Bus,
  taxi: CarTaxiFront,
  car: Wrench,
  home: House,
  rent: KeyRound,
  building: Building2,
  utilities: Lightbulb,
  power: Zap,
  water: Droplet,
  gas: Flame,
  internet: Wifi,
  phone: Smartphone,
  health: HeartPulse,
  entertainment: Clapperboard,
  subscription: Repeat,
  shopping: ShoppingBag,
  education: GraduationCap,
  pet: PawPrint,
  gift: Gift,
  tax: Receipt,
  bank: Landmark,
  card: CreditCard,
  cash: Banknote,
  wallet: Wallet,
  savings: PiggyBank,
  salary: Briefcase,
  freelance: Laptop,
  refund: Undo2,
  interest: Percent,
  income: TrendingUp,
  adjust: SlidersHorizontal,
  other: CircleEllipsis,
};

/** Category or account icon in a tinted circle. Decorative: pair it with visible text. */
export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  className?: string | undefined;
}) {
  const Icon = (icon && ICONS[icon as IconKey]) || CircleEllipsis;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full',
        className,
      )}
      style={{ backgroundColor: `${color ?? '#64748b'}22`, color: color ?? '#64748b' }}
    >
      <Icon className="size-4" />
    </span>
  );
}
