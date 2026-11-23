import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable20261122173000
  implements MigrationInterface
{
  name = 'CreateUsersTable20261122173000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "displayName" VARCHAR(100) NOT NULL,
        username VARCHAR(30) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE,
        "passwordHash" VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        "avatarUrl" VARCHAR(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_username"
      ON users (username);
    `);
  }

  public async down(): Promise<void> {
    // Ataylab DROP TABLE ishlatilmaydi.
    // Foydalanuvchi ma'lumotlarini xavfsiz saqlaymiz.
  }
}