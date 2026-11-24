const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const PRODUCTION_API_URL =
  'https://humorous-imagination-production.up.railway.app';

// Use the deployed API by default so a phone running Expo does not silently
// try to reach the developer's laptop. Set EXPO_PUBLIC_API_URL to override it.
export const API_BASE_URL = (
  configuredApiUrl || PRODUCTION_API_URL
).replace(/\/+$/, '');
