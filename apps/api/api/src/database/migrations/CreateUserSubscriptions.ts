import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSubscriptions20261124120000 implements MigrationInterface {
  name = 'CreateUserSubscriptions20261124120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "planKey" VARCHAR(40) NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('google_play', 'click', 'payme')),
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'refunded')),
        "providerReference" VARCHAR(255),
        "startsAt" TIMESTAMPTZ,
        "expiresAt" TIMESTAMPTZ,
        "autoRenew" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_subscriptions_provider_reference"
      ON user_subscriptions (provider, "providerReference")
      WHERE "providerReference" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_user_status"
      ON user_subscriptions ("userId", status, "expiresAt")
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: subscription and payment history must be preserved.
  }
}
