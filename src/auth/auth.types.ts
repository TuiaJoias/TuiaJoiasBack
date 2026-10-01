export interface JwtPayload {
  sub: number;
  email: string;
}

/** Dados do administrador disponíveis em request.user. */
export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  expiresAt: string;
  user: AuthenticatedUser;
}
