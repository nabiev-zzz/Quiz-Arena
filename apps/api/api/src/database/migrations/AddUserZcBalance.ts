import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserZcBalance20261125230000 implements MigrationInterface {
  name = 'AddUserZcBalance20261125230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "zcBalance"
      INTEGER NOT NULL DEFAULT 0
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: preserve user wallet balances.
  }
}
