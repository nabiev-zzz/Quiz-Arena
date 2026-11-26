import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiQueueEnqueuedAt20261125104000 implements MigrationInterface {
  name = 'AddAiQueueEnqueuedAt20261125104000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_generation_jobs"
      ADD COLUMN IF NOT EXISTS "queueEnqueuedAt" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ai_generation_jobs_outbox"
      ON "ai_generation_jobs" ("status", "queueEnqueuedAt", "createdAt")
    `);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive.
  }
}
