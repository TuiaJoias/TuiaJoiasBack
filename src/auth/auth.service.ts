import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthenticatedUser, JwtPayload, LoginResponse } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import { hashPassword, verifyPassword } from './password.js';

const INVALID_CREDENTIALS = 'Credenciais inválidas.';

@Injectable()
export class AuthService {
  /** Hash usado quando o email não existe, para o tempo de resposta não revelar isso. */
  private readonly dummyHash = hashPassword('tuia-joias-dummy-password');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async login({ email, password }: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findByEmailWithPassword(email);
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const passwordMatches = await verifyPassword(password, hash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.expiresIn,
      expiresAt: new Date(exp * 1000).toISOString(),
      user: toAuthenticatedUser(user),
    };
  }
}

export function toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email };
}
