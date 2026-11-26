import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService cosmetic ownership', () => {
  const user = {
    id: 'user-1',
    displayName: 'Test User',
    username: 'test_user',
    email: null,
    emailVerifiedAt: null,
    phoneNumber: null,
    phoneVerifiedAt: null,
    role: 'user' as const,
    status: 'active' as const,
    xp: 0,
    zcBalance: 1000,
    rankPoints: 0,
    level: 1,
    avatarUrl: null,
    bio: null,
    profileFrame: null as string | null,
    avatarDecoration: null as string | null,
    profileBadge: null as string | null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  let service: AuthService;
  let userRepository: any;
  let storeItems: any;

  beforeEach(() => {
    Object.assign(user, {
      profileFrame: null,
      avatarDecoration: null,
      profileBadge: null,
    });
    userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn(async (value) => value),
    };
    storeItems = {
      exists: jest.fn().mockResolvedValue(true),
    };
    service = new AuthService(
      userRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      storeItems,
    );
  });

  it('allows equipping an owned profile badge', async () => {
    const result = await service.updateProfile('user-1', { profileBadge: 'legend' });

    expect(storeItems.exists).toHaveBeenCalledWith({
      where: { userId: 'user-1', kind: 'badge', itemId: 'badge_legend' },
    });
    expect(user.profileBadge).toBe('legend');
    expect(result.profileBadge).toBe('legend');
  });

  it('rejects equipping a badge that is not in the user inventory', async () => {
    storeItems.exists.mockResolvedValue(false);

    await expect(service.updateProfile('user-1', { profileBadge: 'legend' }))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(user.profileBadge).toBeNull();
  });

  it('uses the store product id when re-equipping a 3D frame', async () => {
    const result = await service.updateProfile('user-1', { profileFrame: 'galaxy3d' });

    expect(storeItems.exists).toHaveBeenCalledWith({
      where: { userId: 'user-1', kind: 'frame', itemId: 'effect_galaxy3d' },
    });
    expect(result.profileFrame).toBe('galaxy3d');
  });

  it('rejects re-equipping a 3D frame that is not owned', async () => {
    storeItems.exists.mockResolvedValue(false);

    await expect(service.updateProfile('user-1', { profileFrame: 'neon3d' }))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('allows clearing an equipped badge without requiring ownership', async () => {
    user.profileBadge = 'legend';

    const result = await service.updateProfile('user-1', { profileBadge: null });

    expect(storeItems.exists).not.toHaveBeenCalled();
    expect(result.profileBadge).toBeNull();
  });
});
