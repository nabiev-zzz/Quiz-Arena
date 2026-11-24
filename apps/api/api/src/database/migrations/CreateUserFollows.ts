import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserFollows20261124070000 implements MigrationInterface {
  name = 'CreateUserFollows20261124070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "followerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "followedId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_follows_pair" UNIQUE ("followerId", "followedId"),
        CONSTRAINT "CHK_user_follows_not_self" CHECK ("followerId" <> "followedId")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_user_follows_follower" ON user_follows ("followerId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_user_follows_followed" ON user_follows ("followedId")');
  }

  public async down(): Promise<void> {
    // Foydalanuvchi ijtimoiy ma'lumotlari xavfsizligi uchun DROP ishlatilmaydi.
  }
}
