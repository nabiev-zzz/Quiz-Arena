import Constants from 'expo-constants';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const PRODUCTION_API_URL =
  'https://humorous-imagination-production.up.railway.app';

function getDevelopmentApiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];

    if (host) {
      return `http://${host}:3000`;
    }
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = (
  configuredApiUrl ||
  (__DEV__ ? getDevelopmentApiUrl() : PRODUCTION_API_URL)
).replace(/\/+$/, '');