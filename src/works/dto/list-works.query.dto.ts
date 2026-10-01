import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, MaxLength, Min } from 'class-validator';
import { SLUG_PATTERN } from '../../categories/dto/create-category.dto.js';
import { Trim } from '../../common/decorators/transform.decorators.js';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export class ListAdminWorksQueryDto {
  /** Slug da categoria, ex.: ?category=aneis */
  @IsOptional()
  @Trim()
  @Matches(SLUG_PATTERN, { message: 'Categoria inválida.' })
  @MaxLength(80, { message: 'Categoria inválida.' })
  category?: string;
}

export class ListPublicWorksQueryDto extends ListAdminWorksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser maior ou igual a 1.' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro.' })
  @Min(1, { message: 'limit deve ser maior ou igual a 1.' })
  @Max(MAX_PAGE_SIZE, { message: `limit deve ser no máximo ${MAX_PAGE_SIZE}.` })
  limit: number = DEFAULT_PAGE_SIZE;
}
