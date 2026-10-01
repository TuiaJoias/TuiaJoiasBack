import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export enum UploadPurpose {
  /** Foto de um trabalho novo: conta para o limite MAX_WORKS. */
  Create = 'create',
  /** Troca da foto de um trabalho existente. */
  Replace = 'replace',
}

/** POST /admin/works/uploads — o que o navegador vai enviar ao Storage. */
export class CreateUploadDto {
  @IsString({ message: 'Informe o tipo do arquivo.' })
  @IsNotEmpty({ message: 'Informe o tipo do arquivo.' })
  contentType: string;

  @IsInt({ message: 'Informe o tamanho do arquivo em bytes.' })
  @Min(1, { message: 'Arquivo vazio.' })
  size: number;

  @IsOptional()
  @IsEnum(UploadPurpose, { message: 'purpose deve ser "create" ou "replace".' })
  purpose: UploadPurpose = UploadPurpose.Create;
}
