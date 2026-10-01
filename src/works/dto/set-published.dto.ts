import { IsBoolean } from 'class-validator';
import { ToBoolean } from '../../common/decorators/transform.decorators.js';

export class SetPublishedDto {
  @ToBoolean()
  @IsBoolean({ message: 'isPublished deve ser true ou false.' })
  isPublished: boolean;
}
