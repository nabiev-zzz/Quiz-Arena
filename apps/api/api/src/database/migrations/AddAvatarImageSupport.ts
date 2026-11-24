import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarImageSupport20261124230000 implements MigrationInterface {
  name = 'AddAvatarImageSupport20261124230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ALTER COLUMN "avatarUrl" TYPE TEXT
      USING "avatarUrl"::text
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: keep uploaded profile images.
  }
}
