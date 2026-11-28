import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectMessageModeration20261128150000 implements MigrationInterface {
  name = 'AddDirectMessageModeration20261128150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "editedAt" timestamptz NULL');
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz NULL');
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "deletedBy" uuid NULL');
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "deletedForEveryone" boolean NOT NULL DEFAULT false');
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "senderDeletedAt" timestamptz NULL');
    await queryRunner.query('ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS "recipientDeletedAt" timestamptz NULL');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_direct_messages_deleted" ON direct_messages ("conversationId", "deletedForEveryone", "deletedAt")');
  }

  public async down(): Promise<void> {
    // Preserve user-generated message and moderation history during rollback.
  }
}
