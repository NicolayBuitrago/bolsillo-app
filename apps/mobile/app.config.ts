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
  plugins: ['expo-router', 'expo-status-bar'],
  experiments: {
    typedRoutes: true,
  },
});
