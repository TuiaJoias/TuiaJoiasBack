import { Transform } from 'class-transformer';

/** Remove espaços nas pontas de strings. */
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/**
 * Converte "true"/"false" (enviados em multipart/form-data) em boolean.
 * Valores não reconhecidos passam adiante para o @IsBoolean() rejeitar.
 */
export const ToBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const value = obj[key];
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  });
