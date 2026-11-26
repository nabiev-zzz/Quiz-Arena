import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { ZcStoreItem } from './entities/zc-store-item.entity';

type StoreKind = 'frame' | 'decoration' | 'badge';
type StoreProduct = { id: string; name: string; description: string; kind: StoreKind; value: string; price: number };

const PRODUCTS: StoreProduct[] = [
  { id: 'frame_aurora', name: 'Aurora ramkasi', description: 'Profil uchun yorqin aurora ramkasi', kind: 'frame', value: 'aurora', price: 150 },
  { id: 'frame_royal', name: 'Royal ramkasi', description: 'Oltin tusli qirollik ramkasi', kind: 'frame', value: 'royal', price: 250 },
  { id: 'frame_ocean', name: 'Ocean ramkasi', description: 'Moviy okean uslubidagi ramka', kind: 'frame', value: 'ocean', price: 200 },
  { id: 'effect_neon3d', name: 'Neon 3D', description: 'Binafsha neon yaltirashli 3D profil effekti', kind: 'frame', value: 'neon3d', price: 450 },
  { id: 'effect_inferno3d', name: 'Inferno 3D', description: 'Olovrang hajmli 3D effekt', kind: 'frame', value: 'inferno3d', price: 500 },
  { id: 'effect_frost3d', name: 'Frost 3D', description: 'Muzdek moviy 3D nur effekti', kind: 'frame', value: 'frost3d', price: 450 },
  { id: 'effect_galaxy3d', name: 'Galaxy 3D', description: 'Kosmik binafsha-ko‘k 3D effekt', kind: 'frame', value: 'galaxy3d', price: 600 },
  { id: 'decoration_crown', name: 'Toj bezagi', description: 'Avatar uchun toj belgisi', kind: 'decoration', value: 'crown', price: 350 },
  { id: 'decoration_laurel', name: 'Laurel bezagi', description: 'Avatar uchun dafna yaprog‘i', kind: 'decoration', value: 'laurel', price: 180 },
  { id: 'decoration_star', name: 'Yulduz bezagi', description: 'Avatar uchun yulduz belgisi', kind: 'decoration', value: 'star', price: 120 },
  { id: 'badge_legend', name: 'Legend nishoni', description: 'Profilingizda afsonaviy bilimdon nishoni', kind: 'badge', value: 'legend', price: 700 },
  { id: 'badge_champion', name: 'Champion nishoni', description: 'G‘oliblar uchun oltin chempion belgisi', kind: 'badge', value: 'champion', price: 550 },
  { id: 'badge_scholar', name: 'Scholar nishoni', description: 'Bilim va izlanish ramzi', kind: 'badge', value: 'scholar', price: 350 },
  { id: 'badge_streak', name: 'Streak nishoni', description: 'Doimiy faollik uchun olov belgisi', kind: 'badge', value: 'streak', price: 300 },
];

@Injectable()
export class ZcStoreService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async catalog(userId: string) {
    const owned = await this.dataSource.getRepository(ZcStoreItem).find({ where: { userId } });
    const ownedIds = new Set(owned.map((item) => item.itemId));
    return {
      currency: 'ZC',
      items: PRODUCTS.map((product) => ({ ...product, owned: ownedIds.has(product.id) })),
    };
  }

  async inventory(userId: string) {
    return this.dataSource.getRepository(ZcStoreItem).find({
      where: { userId },
      order: { purchasedAt: 'DESC' },
    });
  }

  async purchase(userId: string, itemId: string) {
    const product = PRODUCTS.find((item) => item.id === itemId);
    if (!product) throw new NotFoundException('Do‘kon mahsuloti topilmadi');

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

      const itemRepo = manager.getRepository(ZcStoreItem);
      const alreadyOwned = await itemRepo.findOne({ where: { userId, itemId } });
      if (alreadyOwned) {
        return { purchased: false, alreadyOwned: true, item: product, balance: user.zcBalance };
      }

      const balance = Number(user.zcBalance ?? 0);
      if (!Number.isSafeInteger(balance) || balance < product.price) {
        throw new BadRequestException('ZC balansi xarid uchun yetarli emas');
      }

      user.zcBalance = balance - product.price;
      if (product.kind === 'frame') user.profileFrame = product.value;
      else if (product.kind === 'decoration') user.avatarDecoration = product.value;
      else user.profileBadge = product.value;

      await manager.save(User, user);
      await manager.save(ZcTransaction, manager.create(ZcTransaction, {
        userId,
        type: 'debit',
        amount: product.price,
        balanceAfter: user.zcBalance,
        reason: `Do‘kon: ${product.name}`,
        idempotencyKey: `store:${userId}:${itemId}`,
      }));
      await itemRepo.save(itemRepo.create({
        userId,
        itemId: product.id,
        kind: product.kind,
        price: product.price,
      }));

      return {
        purchased: true,
        alreadyOwned: false,
        item: product,
        balance: user.zcBalance,
        equipped: true,
      };
    });
  }
}