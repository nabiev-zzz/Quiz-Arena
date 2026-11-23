import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRankPoints20261124002500
  implements MigrationInterface {
  name = 'AddUserRankPoints20261124002500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "rankPoints"
      INTEGER NOT NULL DEFAULT 0
    `);
  }

  async down(): Promise<void> {
    // Foydalanuvchi Rank ma'lumotlarini saqlab qolamiz.
  }
}