import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLearningWebSessions20261124210000 implements MigrationInterface {
  name = 'CreateLearningWebSessions20261124210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS learning_web_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "subjectId" VARCHAR(80) NOT NULL,
        "topicId" VARCHAR(100) NOT NULL,
        language VARCHAR(5) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        "questionIds" JSONB NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "submittedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CHK_learning_web_sessions_question_ids"
          CHECK (jsonb_typeof("questionIds") = 'array')
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_learning_web_sessions_user_expiry"
      ON learning_web_sessions ("userId", "expiresAt")
    `);
  }

  public async down(): Promise<void> {
    // Ataylab bo‘sh: foydalanuvchi test sessiyalari tarixini o‘chirmaymiz.
  }
}
