import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean, Trim } from '../../common/decorators/transform.decorators.js';
import { INVALID_UPLOAD_MESSAGE, STAGING_PATH_PATTERN } from '../staging/staging-path.js';

/**
 * PATCH /admin/works/:id (JSON). Todos os campos são opcionais; description
 * vazia ou null remove a descrição. Para trocar a foto, envie `uploadPath`
 * obtido em POST /admin/works/uploads (purpose "replace").
 */
export class UpdateWorkDto {
  @IsOptional()
  @IsString({ message: INVALID_UPLOAD_MESSAGE })
  @Matches(STAGING_PATH_PATTERN, { message: INVALID_UPLOAD_MESSAGE })
  uploadPath?: string;

  @IsOptional()
  @Trim()
  @IsString({ message: 'Informe o título.' })
  @IsNotEmpty({ message: 'O título não pode ficar vazio.' })
  @MaxLength(120, { message: 'O título deve ter no máximo 120 caracteres.' })
  title?: string;

  @IsOptional()
  @Trim()
  @IsString({ message: 'A descrição deve ser um texto.' })
  @MaxLength(160, { message: 'A descrição deve ter no máximo 160 caracteres.' })
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Selecione uma categoria válida.' })
  @Min(1, { message: 'Selecione uma categoria válida.' })
  categoryId?: number;

  @IsOptional()
  @ToBoolean()
  @IsBoolean({ message: 'isFavorite deve ser true ou false.' })
  isFavorite?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean({ message: 'isPublished deve ser true ou false.' })
  isPublished?: boolean;
}
