import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators.js';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = 'O slug deve conter apenas letras minúsculas, números e hífens.';

export class CreateCategoryDto {
  @Trim()
  @IsString({ message: 'Informe o nome da categoria.' })
  @IsNotEmpty({ message: 'Informe o nome da categoria.' })
  @MaxLength(80, { message: 'O nome da categoria deve ter no máximo 80 caracteres.' })
  name: string;

  /** Opcional: gerado a partir do nome quando omitido. */
  @IsOptional()
  @Trim()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(80, { message: 'O slug deve ter no máximo 80 caracteres.' })
  slug?: string;
}
