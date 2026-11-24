import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuthOtpPurpose = 'register' | 'password_reset' | 'phone_login' | 'phone_link';

@Entity('auth_otps')
@Index('IDX_auth_otps_phone_purpose_created', ['phoneNumber', 'purpose', 'createdAt'])
export class AuthOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  phoneNumber: string;

  @Column({ type: 'varchar', length: 24 })
  purpose: AuthOtpPurpose;

  @Column({ type: 'varchar', length: 128, select: false })
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
