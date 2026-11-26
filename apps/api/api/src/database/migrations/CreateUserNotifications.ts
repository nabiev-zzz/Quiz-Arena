import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserNotifications20261126150000 implements MigrationInterface {
  name = 'CreateUserNotifications20261126150000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        type varchar(30) NOT NULL,
        title varchar(120) NOT NULL,
        body text NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_notifications_user_created" ON user_notifications ("userId", "createdAt" DESC)`);
  }
  public async down(): Promise<void> {
    // Preserve notification history; migration rollback is intentionally non-destructive.
  }
}
