import { BadRequestException } from '@nestjs/common';
import { getPlanEntitlements } from './plan-entitlements';
import { FeatureUsageService } from './feature-usage.service';

describe('FeatureUsageService', () => {
  const query = jest.fn();
  const current = jest.fn();
  const service = new FeatureUsageService(
    { query } as never,
    { current } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('atomically consumes a monthly PDF quota', async () => {
    current.mockResolvedValue({ tier: 'free', entitlements: getPlanEntitlements(null) });
    query.mockResolvedValue([{ usageCount: 1 }]);

    await expect(service.consume('user-1', 'statsPdf')).resolves.toMatchObject({
      allowed: true, featureKey: 'statsPdf', limit: 1, used: 1, remaining: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects quota consumption when the server-side limit is reached', async () => {
    current.mockResolvedValue({ tier: 'free', entitlements: getPlanEntitlements(null) });
    query.mockResolvedValue([]);

    await expect(service.consume('user-1', 'statsPdf')).resolves.toMatchObject({
      allowed: false, limit: 1, remaining: 0,
    });
  });

  it('does not query usage storage for unlimited LEGENDA+ exports', async () => {
    current.mockResolvedValue({ tier: 'legenda_plus', entitlements: getPlanEntitlements('legenda_plus_yearly') });

    await expect(service.consume('user-1', 'statsPdf')).resolves.toMatchObject({
      allowed: true, tier: 'legenda_plus', period: 'unlimited', limit: null,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects unsupported feature keys', async () => {
    await expect(service.consume('user-1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(current).not.toHaveBeenCalled();
  });
});
