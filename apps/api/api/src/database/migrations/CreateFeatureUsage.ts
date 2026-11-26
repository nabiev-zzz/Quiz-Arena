import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureUsage20261124203000 implements MigrationInterface {
  name = 'CreateFeatureUsage20261124203000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "featureKey" varchar(32) NOT NULL,
        "periodKey" varchar(10) NOT NULL,
        "usageCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT NOW(),
        "updatedAt" timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_feature_usage_user_feature_period"
      ON "feature_usage" ("userId", "featureKey", "periodKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_feature_usage_user"
      ON "feature_usage" ("userId")
    `);
  }

  async down(): Promise<void> {
    throw new Error('Feature usage migration is intentionally non-destructive; do not drop user quota history.');
  }
}
