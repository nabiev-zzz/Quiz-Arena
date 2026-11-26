import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The original subscriptions table allowed only store/payment providers.
 * QA provisioning uses an explicit admin_grant provider, so extend the
 * database CHECK constraint without touching existing subscription rows.
 */
export class AllowAdminGrantSubscriptionProvider20261126130000 implements MigrationInterface {
  name = 'AllowAdminGrantSubscriptionProvider20261126130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_subscriptions
      DROP CONSTRAINT IF EXISTS user_subscriptions_provider_check
    `);
    await queryRunner.query(`
      ALTER TABLE user_subscriptions
      ADD CONSTRAINT user_subscriptions_provider_check
      CHECK (provider IN ('google_play', 'click', 'payme', 'admin_grant'))
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: keep admin-granted subscription history.
  }
}
