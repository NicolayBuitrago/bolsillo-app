import { z } from 'zod';
import { timeZoneSchema } from '../dates';
import { currencyCodeSchema } from '../money';

export const CAPTURE_RETENTION_DAYS = { min: 7, max: 365, default: 90 } as const;

export const settingsSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  timezone: timeZoneSchema,
  llmExtractionEnabled: z.boolean(),
  captureBodyRetentionDays: z.number().int(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsSchema = z.object({
  defaultCurrency: currencyCodeSchema.optional(),
  timezone: timeZoneSchema.optional(),
  llmExtractionEnabled: z.boolean().optional(),
  captureBodyRetentionDays: z
    .number()
    .int()
    .min(CAPTURE_RETENTION_DAYS.min)
    .max(CAPTURE_RETENTION_DAYS.max)
    .optional(),
});

export type UpdateSettingsInput = z.input<typeof updateSettingsSchema>;
