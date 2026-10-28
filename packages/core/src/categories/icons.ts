import { z } from 'zod';

/**
 * Platform-neutral icon keys. Web maps them to lucide icons and mobile to
 * Ionicons, so the stored value never depends on an icon library.
 */
export const ICON_KEYS = [
  'food',
  'groceries',
  'restaurant',
  'delivery',
  'transport',
  'fuel',
  'bus',
  'taxi',
  'car',
  'home',
  'rent',
  'building',
  'utilities',
  'power',
  'water',
  'gas',
  'internet',
  'phone',
  'health',
  'entertainment',
  'subscription',
  'shopping',
  'education',
  'pet',
  'gift',
  'tax',
  'bank',
  'card',
  'cash',
  'wallet',
  'savings',
  'salary',
  'freelance',
  'refund',
  'interest',
  'income',
  'adjust',
  'other',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export const iconKeySchema = z.enum(ICON_KEYS);

/** Palette offered when creating accounts and categories. */
export const PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#64748b',
] as const;

export const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'Expected a hex color like #22c55e');
