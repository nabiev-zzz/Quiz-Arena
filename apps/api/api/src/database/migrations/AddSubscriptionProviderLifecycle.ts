import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionProviderLifecycle20261124140000 implements MigrationInterface {
  name = 'AddSubscriptionProviderLifecycle20261124140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS click_merchant_prepare_seq START WITH 100000`);
    await queryRunner.query(`
      ALTER TABLE subscription_payments
        ADD COLUMN IF NOT EXISTS "providerPrepareId" BIGINT,
        ADD COLUMN IF NOT EXISTS "providerState" INTEGER,
        ADD COLUMN IF NOT EXISTS "providerCreatedAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "providerPerformedAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "providerCancelledAt" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "providerCancelReason" INTEGER,
        ADD COLUMN IF NOT EXISTS "providerPayload" JSONB
    `);
    await queryRunner.query(`ALTER TABLE subscription_payments ALTER COLUMN "providerTransactionId" TYPE VARCHAR(2048)`);
    await queryRunner.query(`ALTER TABLE user_subscriptions ALTER COLUMN "providerReference" TYPE VARCHAR(2048)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscription_payments_click_prepare"
      ON subscription_payments ("providerPrepareId")
      WHERE "providerPrepareId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: preserve payment audit data.
  }
}
