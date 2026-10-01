import type { DataSource } from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';
import { slugify } from '../../common/utils/slugify.js';

export const INITIAL_CATEGORIES = [
  'Correntes',
  'Anéis',
  'Pulseiras',
  'Colares',
  'Pingentes',
  'Alianças',
  'Restauração',
];

/** Idempotente: categorias já existentes são ignoradas. Retorna quantas foram criadas. */
export async function seedCategories(dataSource: DataSource): Promise<number> {
  const result = await dataSource
    .createQueryBuilder()
    .insert()
    .into(Category)
    .values(INITIAL_CATEGORIES.map((name) => ({ name, slug: slugify(name) })))
    .orIgnore()
    .returning(['id'])
    .execute();
  return (result.raw as unknown[]).length;
}
