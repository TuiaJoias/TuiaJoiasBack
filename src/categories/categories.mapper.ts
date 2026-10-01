import type { Category } from './entities/category.entity.js';

export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return { id: category.id, name: category.name, slug: category.slug };
}
