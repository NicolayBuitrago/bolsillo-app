'use client';

import { ICON_KEYS, type IconKey, PALETTE } from '@bolsillo/core/categories';
import { Check } from 'lucide-react';
import { ICONS } from '@/components/category-icon';
import { iconLabels } from '@/features/shared/strings';
import { cn } from '@/lib/utils';

/** Swatches from the shared palette. */
export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((color) => (
          <label
            key={color}
            className="relative flex size-9 cursor-pointer items-center justify-center rounded-full has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            style={{ backgroundColor: color }}
          >
            <input
              type="radio"
              name="color"
              className="sr-only"
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              aria-label={color}
            />
            {value === color ? <Check className="size-4 text-white" aria-hidden="true" /> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Grid of platform-neutral icons with Spanish labels. */
export function IconPicker({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: IconKey;
  color: string;
  onChange: (icon: IconKey) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {ICON_KEYS.map((key) => {
          const Icon = ICONS[key];
          const selected = value === key;
          return (
            <label
              key={key}
              title={iconLabels[key]}
              className={cn(
                'flex size-9 cursor-pointer items-center justify-center rounded-lg border has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                selected ? 'border-transparent' : 'border-border hover:bg-muted',
              )}
              style={selected ? { backgroundColor: `${color}22`, color } : undefined}
            >
              <input
                type="radio"
                name="icon"
                className="sr-only"
                value={key}
                checked={selected}
                onChange={() => onChange(key)}
                aria-label={iconLabels[key]}
              />
              <Icon className="size-4" aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
