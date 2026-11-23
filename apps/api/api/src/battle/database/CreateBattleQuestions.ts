import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBattleQuestions20261122220000
  implements MigrationInterface
{
  name = 'CreateBattleQuestions20261122220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "battle_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "categoryId" character varying(100),
        "language" character varying(5) NOT NULL DEFAULT 'uz',
        "question" text NOT NULL,
        "options" jsonb NOT NULL,
        "correctAnswer" smallint NOT NULL,
        "explanation" text NOT NULL DEFAULT '',
        "difficulty" character varying(20) NOT NULL DEFAULT 'medium',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_battle_questions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_battle_questions_correct_answer"
          CHECK ("correctAnswer" >= 0 AND "correctAnswer" <= 3),
        CONSTRAINT "CHK_battle_questions_options"
          CHECK (
            jsonb_typeof("options") = 'array'
            AND jsonb_array_length("options") = 4
          )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_battle_questions_filter"
      ON "battle_questions" (
        "categoryId",
        "language",
        "difficulty",
        "isActive"
      )
    `);
  }

  // Ataylab bo‘sh: mavjud ma’lumotlarni o‘chirmaslik uchun.
  public async down(): Promise<void> {}
}