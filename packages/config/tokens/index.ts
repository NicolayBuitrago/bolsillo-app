import tokens from './tokens.json' with { type: 'json' };

export type ColorScheme = keyof typeof tokens.color;
export type ColorToken = keyof typeof tokens.color.light;
export type RadiusToken = keyof typeof tokens.radius;

export const colors: Record<ColorScheme, Record<ColorToken, string>> = tokens.color;
export const radius: Record<RadiusToken, number> = tokens.radius;
