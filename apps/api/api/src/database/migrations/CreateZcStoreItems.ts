import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateZcStoreItems20261126020000 implements MigrationInterface {
  name = 'CreateZcStoreItems20261126020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS zc_store_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "itemId" varchar(60) NOT NULL,
        kind varchar(20) NOT NULL CHECK (kind IN ('frame', 'decoration')),
        price integer NOT NULL CHECK (price > 0),
        "purchasedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_zc_store_user_item" UNIQUE ("userId", "itemId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zc_store_user_purchased"
      ON zc_store_items ("userId", "purchasedAt" DESC)
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: keep users' purchased cosmetic ownership.
  }
}
