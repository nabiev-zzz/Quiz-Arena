import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTelegramBotAuthSessions20261128120000 implements MigrationInterface {
  name = 'CreateTelegramBotAuthSessions20261128120000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS telegram_bot_auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "sessionHash" varchar(64) NOT NULL UNIQUE,
      "telegramUserId" varchar(32),
      "phoneNumber" varchar(16),
      "codeHash" varchar(64),
      "firstName" varchar(100),
      "lastName" varchar(100),
      "telegramUsername" varchar(64),
      attempts integer NOT NULL DEFAULT 0,
      "expiresAt" timestamptz NOT NULL,
      "verifiedAt" timestamptz,
      "consumedAt" timestamptz,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_telegram_bot_auth_sessions_expires" ON telegram_bot_auth_sessions ("expiresAt")`);
  }
  public async down(): Promise<void> {
    // Keep authentication records; rollback is intentionally non-destructive.
  }
}
