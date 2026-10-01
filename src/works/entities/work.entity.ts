import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';

@Entity({ name: 'works' })
@Unique('UQ_works_storage_path', ['storagePath'])
@Check('CHK_works_position_positive', '"position" > 0')
@Index('IDX_works_is_published_position', ['isPublished', 'position'])
@Index('IDX_works_position', ['position'])
export class Work {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'PK_works_id',
  })
  id: number;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  description: string | null;

  @Index('IDX_works_category_id')
  @Column({ name: 'category_id', type: 'integer' })
  categoryId: number;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'FK_works_category_id' })
  category: Relation<Category>;

  /** URL pública da imagem otimizada no Storage. */
  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  /** Chave do arquivo no Storage (ex.: works/{uuid}.webp). O binário nunca fica no banco. */
  @Column({ name: 'storage_path', type: 'varchar', length: 255 })
  storagePath: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  isFavorite: boolean;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished: boolean;

  @Column({ type: 'integer' })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
