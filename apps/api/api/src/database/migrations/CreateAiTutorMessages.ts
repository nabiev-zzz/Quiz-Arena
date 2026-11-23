
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiTutorMessages20261122180000
  implements MigrationInterface
{
  name = 'CreateAiTutorMessages20261122180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_tutor_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "FK_ai_tutor_messages_user"
          FOREIGN KEY ("userId")
          REFERENCES users(id)
          ON DELETE CASCADE,

        CONSTRAINT "CHK_ai_tutor_messages_role"
          CHECK (role IN ('user', 'assistant'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_tutor_messages_user_created"
      ON ai_tutor_messages ("userId", "createdAt");
    `);
  }

  public async down(): Promise<void> {
    // Ataylab DROP TABLE ishlatilmaydi.
    // Foydalanuvchilarning suhbat ma'lumotlari saqlanadi.
  }
}
