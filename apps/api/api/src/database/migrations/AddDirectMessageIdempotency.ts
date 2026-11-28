import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageIdempotency20261128130000 implements MigrationInterface {
  name = 'AddDirectMessageIdempotency20261128130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "clientMessageId" varchar(128) NULL');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS "UQ_direct_messages_sender_client_id" ON direct_messages ("senderId", "clientMessageId") WHERE "clientMessageId" IS NOT NULL');
  }

  public async down(): Promise<void> {
    // Keep idempotency metadata and indexes during rollback; never alter user message data.
  }
}
