import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthOAuthCodes20261124151000 implements MigrationInterface {
  name = 'CreateAuthOAuthCodes20261124151000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_oauth_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "codeHash" VARCHAR(64) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "consumedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auth_oauth_codes_user"
      ON auth_oauth_codes ("userId")
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: one-time authentication audit data is retained.
  }
}
