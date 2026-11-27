const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const PRODUCTION_API_URL =
  'https://humorous-imagination-production.up.railway.app';

// Use the deployed API by default so a phone running Expo does not silently
// try to reach the developer's laptop. Set EXPO_PUBLIC_API_URL to override it.
export const API_BASE_URL = (
  configuredApiUrl || PRODUCTION_API_URL
).replace(/\/+$/, '');


// Force fresh API reads: native clients do not retain a matching HTTP cache,
// so a body-less 304 otherwise appears to be an offline/server failure.
let apiReadSequence = 0;
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const requestUrl = isRead
    ? `${url}${url.includes('?') ? '&' : '?'}__fresh=${Date.now()}-${++apiReadSequence}`
    : url;
  const headers = { ...(options.headers as Record<string, string> | undefined) };
  if (isRead) {
    headers['Cache-Control'] = 'no-cache, no-store, max-age=0';
    headers.Pragma = 'no-cache';
  }
  return fetch(requestUrl, { ...options, headers, ...(isRead ? { cache: 'no-store' as RequestCache } : {}) });
}
