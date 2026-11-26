import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateZcTransactions20261126010000 implements MigrationInterface {
  name = 'CreateZcTransactions20261126010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS zc_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        type varchar(10) NOT NULL CHECK (type IN ('credit', 'debit')),
        amount integer NOT NULL CHECK (amount > 0),
        "balanceAfter" integer NOT NULL CHECK ("balanceAfter" >= 0),
        reason varchar(80) NOT NULL,
        "idempotencyKey" varchar(120),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zc_transactions_user_created"
      ON zc_transactions ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_zc_transactions_idempotency"
      ON zc_transactions ("idempotencyKey")
      WHERE "idempotencyKey" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: keep the permanent wallet audit history.
  }
}
