import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/app-config.service.js';
import { UsersService } from '../../users/users.service.js';
import { toAuthenticatedUser } from '../auth.service.js';
import type { AuthenticatedUser, JwtPayload } from '../auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.secret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  /** Confirma que o usuário do token ainda existe. */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Token ausente ou inválido.');
    }
    return toAuthenticatedUser(user);
  }
}
