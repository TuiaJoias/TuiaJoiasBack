import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

function collectMessages(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([rule, message]) =>
      rule === 'whitelistValidation' ? `Campo não permitido: ${path}.` : message,
    );
    const nested = collectMessages(error.children ?? [], path);
    return [...own, ...nested];
  });
}

/** Erros do ValidationPipe no formato { message, details[] }. */
export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({
    message: 'Dados inválidos.',
    details: collectMessages(errors),
  });
}
