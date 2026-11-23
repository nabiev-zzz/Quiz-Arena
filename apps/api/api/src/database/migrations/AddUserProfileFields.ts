
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields20261122192000
  implements MigrationInterface
{
  name = 'AddUserProfileFields20261122192000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "profileFrame" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "avatarDecoration" VARCHAR(50)
    `);
  }

  public async down(): Promise<void> {
    // Foydalanuvchi ma'lumotlarini saqlash uchun DROP ishlatilmaydi.
  }
}
