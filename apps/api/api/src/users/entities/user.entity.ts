import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index('UQ_users_username', ['username'], { unique: true })
@Index('UQ_users_email', ['email'], { unique: true })
@Index('UQ_users_phone_number', ['phoneNumber'], { unique: true, where: '"phoneNumber" IS NOT NULL' })
@Index('UQ_users_google_subject', ['googleSubject'], { unique: true, where: '"googleSubject" IS NOT NULL' })
@Index('UQ_users_telegram_subject', ['telegramSubject'], { unique: true, where: '"telegramSubject" IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  googleSubject: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramSubject: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: 'user' | 'admin';

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'blocked';

  @Column({ type: 'integer', default: 0 })
  xp: number;
  @Column({ type: 'integer', default: 0 })
  rankPoints: number;
  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  profileFrame: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  avatarDecoration: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
