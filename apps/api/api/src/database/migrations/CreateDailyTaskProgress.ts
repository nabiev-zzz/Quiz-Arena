import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDailyTaskProgress20261126030000 implements MigrationInterface {
  name = 'CreateDailyTaskProgress20261126030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_task_progress (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        "taskDate" date NOT NULL,
        "taskId" varchar(50) NOT NULL,
        progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
        "claimedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_daily_task_user_day_task" UNIQUE ("userId", "taskDate", "taskId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_daily_task_user_day"
      ON daily_task_progress ("userId", "taskDate")
    `);
  }

  public async down(): Promise<void> {
    // Non-destructive: retain daily task history and claimed reward audit.
  }
}
