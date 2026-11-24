import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionPayments20261124130000 implements MigrationInterface {
  name = 'CreateSubscriptionPayments20261124130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscription_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "planKey" VARCHAR(40) NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('google_play', 'click', 'payme')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'UZS',
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
        "providerTransactionId" VARCHAR(255),
        "providerOrderId" VARCHAR(255),
        "paidAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscription_payments_provider_transaction"
      ON subscription_payments (provider, "providerTransactionId")
      WHERE "providerTransactionId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscription_payments_user_status"
      ON subscription_payments ("userId", status, "createdAt")
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: payment audit history must be preserved.
  }
}
