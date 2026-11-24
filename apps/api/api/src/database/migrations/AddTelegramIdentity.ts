import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramIdentity20261124190000 implements MigrationInterface {
  name = 'AddTelegramIdentity20261124190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "telegramSubject" VARCHAR(255)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_telegram_subject"
      ON users ("telegramSubject")
      WHERE "telegramSubject" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: Telegram identity links are retained.
  }
}
