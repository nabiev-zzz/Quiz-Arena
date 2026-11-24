import { MigrationInterface, QueryRunner } from 'typeorm';
import { learningCatalog } from '../../learning/learning-catalog';

export class CreateLearningQuestionBank20261124200000 implements MigrationInterface {
  name = 'CreateLearningQuestionBank20261124200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS learning_topics (
        "subjectId" VARCHAR(80) NOT NULL,
        "topicId" VARCHAR(100) NOT NULL,
        "subjectName" VARCHAR(120) NOT NULL,
        "topicName" VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        "questionCount" INTEGER NOT NULL DEFAULT 20,
        difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_learning_topics" PRIMARY KEY ("subjectId", "topicId"),
        CONSTRAINT "CHK_learning_topics_question_count" CHECK ("questionCount" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS learning_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "subjectId" VARCHAR(80) NOT NULL,
        "topicId" VARCHAR(100) NOT NULL,
        language VARCHAR(5) NOT NULL,
        difficulty VARCHAR(20) NOT NULL,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        "correctAnswer" SMALLINT NOT NULL,
        explanation TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_learning_questions_topic"
          FOREIGN KEY ("subjectId", "topicId")
          REFERENCES learning_topics ("subjectId", "topicId")
          ON DELETE RESTRICT,
        CONSTRAINT "CHK_learning_questions_correct_answer"
          CHECK ("correctAnswer" BETWEEN 0 AND 3),
        CONSTRAINT "CHK_learning_questions_options"
          CHECK (jsonb_array_length(options) = 4)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_learning_questions_topic_bank"
      ON learning_questions ("subjectId", "topicId", language, difficulty, "isActive")
    `);

    for (const subject of learningCatalog) {
      const values: unknown[] = [];
      const placeholders = subject.topics.map((topic, index) => {
        const offset = index * 8;
        values.push(
          subject.id,
          topic.id,
          subject.name,
          topic.name,
          topic.description,
          topic.questionCount,
          topic.difficulty,
          true,
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
      });

      await queryRunner.query(
        `
          INSERT INTO learning_topics (
            "subjectId", "topicId", "subjectName", "topicName",
            description, "questionCount", difficulty, "isActive"
          )
          VALUES ${placeholders.join(', ')}
          ON CONFLICT ("subjectId", "topicId") DO NOTHING
        `,
        values,
      );
    }
  }

  public async down(): Promise<void> {
    // Ataylab bo‘sh: mavjud testlar va o‘quv ma’lumotlari o‘chirilmaydi.
  }
}
