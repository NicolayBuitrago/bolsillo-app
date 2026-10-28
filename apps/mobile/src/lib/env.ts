import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.url({ protocol: /^https?$/ }),
});

// Expo only inlines EXPO_PUBLIC_* variables accessed literally as process.env.NAME.
export const env = envSchema.parse({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
