import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnonymizeDeletedAccountPayments20261125180000 implements MigrationInterface {
  name = 'AnonymizeDeletedAccountPayments20261125180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscription_payments
      ALTER COLUMN "userId" DROP NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      DECLARE fk_name TEXT;
      BEGIN
        SELECT con.conname INTO fk_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
        WHERE rel.relname = 'subscription_payments'
          AND att.attname = 'userId'
          AND att.attnum = ANY(con.conkey)
          AND con.contype = 'f'
        LIMIT 1;
        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE subscription_payments DROP CONSTRAINT %I', fk_name);
        END IF;
      END $$
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: anonymized payment records must remain detached.
  }
}
