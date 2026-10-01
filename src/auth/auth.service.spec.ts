import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AppConfigService } from '../config/app-config.service.js';
import type { User } from '../users/entities/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

describe('AuthService', () => {
  const secret = 'a'.repeat(32);
  const jwt = new JwtService({ secret, signOptions: { expiresIn: '1d' } });
  const config = { jwt: { secret, expiresIn: '1d' } } as AppConfigService;
  let user: User;
  let users: { findByEmailWithPassword: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeAll(async () => {
    user = {
      id: 7,
      name: 'Ourives',
      email: 'ourives@tuiajoias.com.br',
      passwordHash: await hashPassword('senha-muito-segura'),
    } as User;
  });

  beforeEach(() => {
    users = { findByEmailWithPassword: vi.fn() };
    service = new AuthService(users as unknown as UsersService, jwt, config);
  });

  it('retorna token e dados básicos, sem passwordHash', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);

    const result = await service.login({ email: user.email, password: 'senha-muito-segura' });

    expect(result.tokenType).toBe('Bearer');
    expect(result.user).toEqual({ id: 7, name: 'Ourives', email: user.email });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(jwt.verify(result.accessToken)).toMatchObject({ sub: 7, email: user.email });
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('recusa senha incorreta', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    await expect(service.login({ email: user.email, password: 'errada' })).rejects.toThrow(
      new UnauthorizedException('Credenciais inválidas.'),
    );
  });

  it('recusa email inexistente com a mesma mensagem', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ninguem@tuiajoias.com.br', password: 'qualquer-coisa' }),
    ).rejects.toThrow('Credenciais inválidas.');
  });
});
