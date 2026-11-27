import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telegram_bot_auth_sessions')
@Index('UQ_telegram_bot_auth_sessions_session_hash', ['sessionHash'], { unique: true })
@Index('IDX_telegram_bot_auth_sessions_expires', ['expiresAt'])
export class TelegramBotAuthSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64, unique: true, select: false }) sessionHash: string;
  @Column({ type: 'varchar', length: 32, nullable: true }) telegramUserId: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) phoneNumber: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true, select: false }) codeHash: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) firstName: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) lastName: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) telegramUsername: string | null;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) verifiedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) consumedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
