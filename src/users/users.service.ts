import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { normalizeEmail } from '../common/utils/normalize-email.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findById(id: number): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  /** Único ponto que carrega o passwordHash (coluna com select: false). */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }
}
