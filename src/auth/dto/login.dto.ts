import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/transform.decorators.js';

export class LoginDto {
  @Trim()
  @IsEmail({}, { message: 'Informe um email válido.' })
  @MaxLength(255, { message: 'Email muito longo.' })
  email: string;

  @IsString({ message: 'Informe a senha.' })
  @IsNotEmpty({ message: 'Informe a senha.' })
  @MaxLength(128, { message: 'Senha muito longa.' })
  password: string;
}
