import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZcProfileBadges20261126040000 implements MigrationInterface {
  name = 'AddZcProfileBadges20261126040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "profileBadge" varchar(60)
    `);
    await queryRunner.query(`
      ALTER TABLE zc_store_items
      DROP CONSTRAINT IF EXISTS zc_store_items_kind_check
    `);
    await queryRunner.query(`
      ALTER TABLE zc_store_items
      ADD CONSTRAINT "CK_zc_store_items_kind"
      CHECK (kind IN ('frame', 'decoration', 'badge'))
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: preserve badge selections and purchased inventory.
  }
}
