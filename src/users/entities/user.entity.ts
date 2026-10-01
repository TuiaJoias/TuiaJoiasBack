import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
@Unique('UQ_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_users_id',
  })
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Sempre armazenado em minúsculas. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** Hash bcrypt. Nunca é carregado por padrão nem retornado pela API. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
