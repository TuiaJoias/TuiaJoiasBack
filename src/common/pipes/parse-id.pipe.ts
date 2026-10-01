import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

const POSTGRES_INT_MAX = 2_147_483_647;

/** Valida IDs de rota (inteiro positivo dentro do limite do PostgreSQL). */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const id = Number(value);
    if (!/^\d+$/.test(value) || id < 1 || id > POSTGRES_INT_MAX) {
      throw new BadRequestException('ID inválido.');
    }
    return id;
  }
}
