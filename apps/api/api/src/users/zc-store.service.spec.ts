import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ZcStoreService } from './zc-store.service';

describe('ZcStoreService', () => {
  const user = {
    id: 'user-1',
    zcBalance: 1000,
    profileFrame: null as string | null,
    avatarDecoration: null as string | null,
    profileBadge: null as string | null,
  };

  let service: ZcStoreService;
  let manager: any;
  let itemRepository: any;

  beforeEach(() => {
    Object.assign(user, {
      zcBalance: 1000,
      profileFrame: null,
      avatarDecoration: null,
      profileBadge: null,
    });
    itemRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
    };
    manager = {
      findOne: jest.fn().mockResolvedValue(user),
      getRepository: jest.fn((entity) => entity.name === 'ZcStoreItem'
        ? itemRepository
        : { create: jest.fn((value) => value) }),
      save: jest.fn(async (_entity, value) => value),
      create: jest.fn((_entity, value) => value),
    };
    const dataSource = {
      getRepository: jest.fn(() => itemRepository),
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new ZcStoreService(dataSource as any);
  });

  it('saves a purchased profile badge to the account and deducts ZC', async () => {
    const result = await service.purchase('user-1', 'badge_legend');

    expect(result.purchased).toBe(true);
    expect(user.zcBalance).toBe(300);
    expect(user.profileBadge).toBe('legend');
    expect(itemRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'badge_legend',
      kind: 'badge',
      price: 700,
    }));
  });

  it('purchases and equips the animated book wings avatar', async () => {
    const result = await service.purchase('user-1', 'decoration_book_wings');

    expect(result.purchased).toBe(true);
    expect(result.item).toEqual(expect.objectContaining({
      id: 'decoration_book_wings',
      kind: 'decoration',
      value: 'book_wings',
      price: 850,
    }));
    expect(user.zcBalance).toBe(150);
    expect(user.avatarDecoration).toBe('book_wings');
    expect(itemRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'decoration_book_wings',
      kind: 'decoration',
      price: 850,
    }));
  });

  it('purchases and equips the animated laurel wreath avatar', async () => {
    const result = await service.purchase('user-1', 'decoration_laurel_wreath');

    expect(result.purchased).toBe(true);
    expect(result.item).toEqual(expect.objectContaining({
      id: 'decoration_laurel_wreath',
      kind: 'decoration',
      value: 'laurel_wreath',
      price: 650,
    }));
    expect(user.zcBalance).toBe(350);
    expect(user.avatarDecoration).toBe('laurel_wreath');
    expect(itemRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'decoration_laurel_wreath',
      kind: 'decoration',
      price: 650,
    }));
  });

  it('does not charge twice for an already owned cosmetic', async () => {
    itemRepository.findOne.mockResolvedValue({ itemId: 'badge_legend' });

    const result = await service.purchase('user-1', 'badge_legend');

    expect(result.alreadyOwned).toBe(true);
    expect(user.zcBalance).toBe(1000);
    expect(itemRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a purchase when the account has insufficient ZC', async () => {
    user.zcBalance = 100;

    await expect(service.purchase('user-1', 'badge_legend'))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(itemRepository.save).not.toHaveBeenCalled();
  });
});
