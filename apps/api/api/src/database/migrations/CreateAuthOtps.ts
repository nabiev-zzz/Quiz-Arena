import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthOtps20261124150000 implements MigrationInterface {
  name = 'CreateAuthOtps20261124150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR(16),
      ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "googleSubject" VARCHAR(255)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone_number"
      ON users ("phoneNumber")
      WHERE "phoneNumber" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_google_subject"
      ON users ("googleSubject")
      WHERE "googleSubject" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "phoneNumber" VARCHAR(16) NOT NULL,
        purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('register', 'password_reset', 'phone_login')),
        "codeHash" VARCHAR(128) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_otps_phone_purpose_created"
      ON auth_otps ("phoneNumber", purpose, "createdAt" DESC)
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: authentication and audit records are retained.
  }
}
