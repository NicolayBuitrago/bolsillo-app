import { type ColorScheme, colors } from '@bolsillo/config/tokens';
import { vars } from 'nativewind';

/** CSS variables consumed by the Tailwind preset (`bg-background`, `text-foreground`...). */
export const themeVars: Record<ColorScheme, ReturnType<typeof vars>> = {
  light: vars(toCssVariables(colors.light)),
  dark: vars(toCssVariables(colors.dark)),
};

function toCssVariables(palette: Record<string, string>): Record<`--${string}`, string> {
  return Object.fromEntries(Object.entries(palette).map(([name, value]) => [`--${name}`, value]));
}
