import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// Lê o valor original: a conversão implícita transformaria "false" em true.
const toBoolean = ({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
  obj[key] === true || obj[key] === 'true' || obj[key] === '1';

const isProduction = (env: EnvironmentVariables) =>
  env.NODE_ENV === Environment.Production;

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL é obrigatória.' })
  DATABASE_URL: string;

  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_SSL: boolean = false;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET deve ter pelo menos 32 caracteres.' })
  JWT_SECRET: string;

  // Unidade obrigatória: sem ela o jsonwebtoken interpreta o número como milissegundos.
  @Matches(/^\d+(s|m|h|d|w)$/, {
    message: 'JWT_EXPIRES_IN deve ter unidade, ex.: 30m, 12h, 1d ou 7d.',
  })
  JWT_EXPIRES_IN: string = '1d';

  @ValidateIf((env: EnvironmentVariables) => isProduction(env) || !!env.SUPABASE_URL)
  @IsNotEmpty({ message: 'SUPABASE_URL é obrigatória em produção.' })
  @IsUrl(
    { require_tld: false },
    { message: 'SUPABASE_URL deve ser uma URL válida.' },
  )
  SUPABASE_URL?: string;

  @ValidateIf(
    (env: EnvironmentVariables) =>
      isProduction(env) || !!env.SUPABASE_SERVICE_ROLE_KEY,
  )
  @IsNotEmpty({ message: 'SUPABASE_SERVICE_ROLE_KEY é obrigatória em produção.' })
  @IsString({ message: 'SUPABASE_SERVICE_ROLE_KEY deve ser um texto.' })
  SUPABASE_SERVICE_ROLE_KEY?: string;

  /** Bucket público com as imagens otimizadas exibidas no site. */
  @IsString()
  @IsNotEmpty()
  SUPABASE_STORAGE_BUCKET: string = 'works';

  /** Bucket privado que recebe os originais enviados direto pelo navegador. */
  @IsString()
  @IsNotEmpty()
  SUPABASE_UPLOADS_BUCKET: string = 'uploads';

  @IsInt()
  @Min(1)
  @Max(500)
  MAX_FILE_SIZE_MB: number = 25;

  @IsInt()
  @Min(1)
  MAX_WORKS: number = 15;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(8000)
  IMAGE_MAX_DIMENSION: number = 2560;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  IMAGE_WEBP_QUALITY: number = 86;
}

/** Remove strings vazias para que os valores padrão da classe sejam aplicados. */
function dropEmptyValues(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== ''),
  );
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    dropEmptyValues(config),
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    // Variável ausente: mostra só "é obrigatória", sem os erros de formato derivados.
    const messages = errors
      .flatMap((error) => {
        const constraints = error.constraints ?? {};
        return constraints.isNotEmpty ? [constraints.isNotEmpty] : Object.values(constraints);
      })
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${messages}`);
  }

  return validated;
}
