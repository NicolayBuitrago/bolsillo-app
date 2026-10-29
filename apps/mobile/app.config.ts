import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Bolsillo',
  slug: 'bolsillo',
  scheme: 'bolsillo',
  version: '0.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'app.bolsillo.mobile',
  },
  ios: {
    bundleIdentifier: 'app.bolsillo.mobile',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-sqlite',
    'expo-web-browser',
    'expo-notifications',
    'expo-sharing',
  ],
  // Typed routes are generated only by `expo start`, so typecheck would depend
  // on whether Metro ran before (never in CI). Kept off for deterministic checks.
  experiments: {
    typedRoutes: false,
  },
});
