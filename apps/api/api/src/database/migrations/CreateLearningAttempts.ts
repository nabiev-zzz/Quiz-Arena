import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLearningAttempts20261124090000 implements MigrationInterface {
  name = 'CreateLearningAttempts20261124090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS learning_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "subjectId" VARCHAR(80) NOT NULL,
        "subjectName" VARCHAR(120) NOT NULL,
        "topicId" VARCHAR(100) NOT NULL,
        "topicName" VARCHAR(160) NOT NULL,
        "totalQuestions" INTEGER NOT NULL,
        "correctAnswers" INTEGER NOT NULL,
        accuracy NUMERIC(5, 2) NOT NULL,
        "completedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CHK_learning_attempts_total" CHECK ("totalQuestions" > 0),
        CONSTRAINT "CHK_learning_attempts_correct" CHECK ("correctAnswers" >= 0 AND "correctAnswers" <= "totalQuestions")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_learning_attempts_user_completed"
      ON learning_attempts ("userId", "completedAt")
    `);
  }

  public async down(): Promise<void> {
    // Ma'lumotlarni yo'qotmaslik uchun DROP TABLE ishlatilmaydi.
  }
}
