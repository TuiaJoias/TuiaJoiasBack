import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(error: unknown, user: TUser | false, info?: { name?: string }): TUser {
    if (error || !user) {
      const expired = info?.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expired ? 'Sessão expirada. Faça login novamente.' : 'Token ausente ou inválido.',
      );
    }
    return user;
  }
}
