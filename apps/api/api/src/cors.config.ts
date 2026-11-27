/**
 * Shared HTTP and Socket.IO origin policy.
 * Native mobile clients commonly omit Origin; browser origins must be explicit.
 */
const productionOrigins = ['https://quiz-arena-website-production.up.railway.app'];

export function getAllowedCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const development = env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:8081', 'http://localhost:19006', 'http://127.0.0.1:8081'];
  return [...new Set([...productionOrigins, ...configured, ...development])];
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins = getAllowedCorsOrigins(),
): boolean {
  // Requests from native apps, server-to-server callers and health probes may omit Origin.
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}
