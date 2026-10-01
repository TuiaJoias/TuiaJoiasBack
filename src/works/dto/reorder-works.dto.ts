import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @IsInt({ message: 'Cada item precisa de um id inteiro.' })
  @Min(1, { message: 'Cada item precisa de um id válido.' })
  id: number;

  @IsInt({ message: 'Cada item precisa de uma posição inteira.' })
  @Min(1, { message: 'As posições começam em 1.' })
  position: number;
}

/** Lista completa dos trabalhos com as novas posições (1..N). */
export class ReorderWorksDto {
  @IsArray({ message: 'Envie a lista de itens em "items".' })
  @ArrayMinSize(1, { message: 'Envie pelo menos um item.' })
  @ArrayMaxSize(1000, { message: 'Lista de itens muito grande.' })
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
