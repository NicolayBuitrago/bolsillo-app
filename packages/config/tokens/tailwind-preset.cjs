// Tailwind 3 preset (used by NativeWind in apps/mobile).
// Colors point to CSS variables so the active scheme can be swapped at runtime
// with NativeWind's `vars()`; see apps/mobile/src/lib/theme.ts.
const tokens = require('./tokens.json');

const colors = Object.fromEntries(
  Object.keys(tokens.color.light).map((name) => [name, `var(--${name})`]),
);

const borderRadius = Object.fromEntries(
  Object.entries(tokens.radius).map(([name, px]) => [name, `${px}px`]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors,
      borderRadius,
    },
  },
};
