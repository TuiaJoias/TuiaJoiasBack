import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators.js';
import { SLUG_PATTERN } from './create-category.dto.js';

export class UpdateCategoryDto {
  @IsOptional()
  @Trim()
  @IsString({ message: 'Informe o nome da categoria.' })
  @IsNotEmpty({ message: 'Informe o nome da categoria.' })
  @MaxLength(80, { message: 'O nome da categoria deve ter no máximo 80 caracteres.' })
  name?: string;

  /** O slug só muda quando enviado, para não quebrar links já publicados. */
  @IsOptional()
  @Trim()
  @Matches(SLUG_PATTERN, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífens.',
  })
  @MaxLength(80, { message: 'O slug deve ter no máximo 80 caracteres.' })
  slug?: string;
}
