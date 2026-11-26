import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDirectMessages20261126200000 implements MigrationInterface {
  name = 'CreateDirectMessages20261126200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS direct_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "participantOneId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "participantTwoId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "lastMessageAt" timestamptz NOT NULL DEFAULT now(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_direct_conversations_distinct" CHECK ("participantOneId" <> "participantTwoId"),
        CONSTRAINT "UQ_direct_conversations_pair" UNIQUE ("participantOneId", "participantTwoId")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_direct_conversations_one_last" ON direct_conversations ("participantOneId", "lastMessageAt" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_direct_conversations_two_last" ON direct_conversations ("participantTwoId", "lastMessageAt" DESC)`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        "senderId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "recipientId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        content varchar(4000) NOT NULL,
        "readAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_direct_messages_conversation_created" ON direct_messages ("conversationId", "createdAt" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_direct_messages_recipient_unread" ON direct_messages ("conversationId", "recipientId", "readAt")`);
  }

  public async down(): Promise<void> {
    // Direct messages are user-generated content; rollback never deletes conversations or messages.
  }
}
