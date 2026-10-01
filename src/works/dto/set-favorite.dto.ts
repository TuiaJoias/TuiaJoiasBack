import { IsBoolean } from 'class-validator';
import { ToBoolean } from '../../common/decorators/transform.decorators.js';

export class SetFavoriteDto {
  @ToBoolean()
  @IsBoolean({ message: 'isFavorite deve ser true ou false.' })
  isFavorite: boolean;
}
