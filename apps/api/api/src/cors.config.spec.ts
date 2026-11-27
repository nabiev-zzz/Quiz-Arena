import { describe, expect, it } from '@jest/globals';
import { getAllowedCorsOrigins, isAllowedCorsOrigin } from './cors.config';

describe('CORS origin policy', () => {
  it('always includes the production web app and configured exact origins', () => {
    const origins = getAllowedCorsOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://custom.example, https://admin.example,https://custom.example',
    } as NodeJS.ProcessEnv);

    expect(origins).toEqual([
      'https://quiz-arena-website-production.up.railway.app',
      'https://custom.example',
      'https://admin.example',
    ]);
  });

  it('does not add localhost origins in production', () => {
    expect(getAllowedCorsOrigins({ NODE_ENV: 'production' } as NodeJS.ProcessEnv))
      .not.toContain('http://localhost:8081');
  });

  it('allows native requests without Origin and rejects unknown browser origins', () => {
    const allowlist = ['https://quiz-arena-website-production.up.railway.app'];
    expect(isAllowedCorsOrigin(undefined, allowlist)).toBe(true);
    expect(isAllowedCorsOrigin(allowlist[0], allowlist)).toBe(true);
    expect(isAllowedCorsOrigin('https://attacker.example', allowlist)).toBe(false);
  });
});
