import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiTutorGenerationJobLink20261125101000 implements MigrationInterface {
  name = 'AddAiTutorGenerationJobLink20261125101000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_tutor_messages"
      ADD COLUMN IF NOT EXISTS "generationJobId" UUID NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_tutor_messages_generation_job"
      ON "ai_tutor_messages" ("generationJobId")
      WHERE "generationJobId" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive.
  }
}
