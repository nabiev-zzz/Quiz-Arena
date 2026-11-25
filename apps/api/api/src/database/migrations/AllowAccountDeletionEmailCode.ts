import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowAccountDeletionEmailCode20261125181000 implements MigrationInterface {
  name = 'AllowAccountDeletionEmailCode20261125181000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auth_email_codes DROP CONSTRAINT IF EXISTS auth_email_codes_purpose_check`);
    await queryRunner.query(`
      ALTER TABLE auth_email_codes
      ADD CONSTRAINT auth_email_codes_purpose_check
      CHECK (purpose IN ('verify_email', 'password_reset', 'delete_account'))
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: keep deletion-verification records valid until expiry.
  }
}
