import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthEmailCodes20261124170000 implements MigrationInterface {
  name = 'CreateAuthEmailCodes20261124170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ
    `);
    // Preserve access for accounts created before email verification was introduced.
    await queryRunner.query(`
      UPDATE users
      SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt", now())
      WHERE email IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_email_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verify_email', 'password_reset')),
        "codeHash" VARCHAR(64) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_email_codes_email_purpose_created"
      ON auth_email_codes (email, purpose, "createdAt" DESC)
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: account verification and recovery records are retained.
  }
}
