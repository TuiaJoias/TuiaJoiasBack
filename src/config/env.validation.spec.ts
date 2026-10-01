import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica os padrões e converte tipos', () => {
    const env = validateEnv({ ...base, PORT: '4000', DATABASE_SSL: 'false', MAX_WORKS: '30', SUPABASE_URL: '' });
    expect(env).toMatchObject({
      PORT: 4000,
      DATABASE_SSL: false,
      MAX_WORKS: 30,
      MAX_FILE_SIZE_MB: 25,
      JWT_EXPIRES_IN: '1d',
      SUPABASE_STORAGE_BUCKET: 'works',
    });
  });

  it('lê DATABASE_SSL=true corretamente', () => {
    expect(validateEnv({ ...base, DATABASE_SSL: 'true' }).DATABASE_SSL).toBe(true);
  });

  it('dispensa Supabase em development', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('exige Supabase em production, com mensagens claras', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /SUPABASE_URL é obrigatória em produção\.\n {2}- SUPABASE_SERVICE_ROLE_KEY é obrigatória em produção\.$/,
    );
  });

  it.each([
    [{ JWT_SECRET: 'curto' }, /JWT_SECRET deve ter pelo menos 32 caracteres/],
    [{ JWT_EXPIRES_IN: '3600' }, /JWT_EXPIRES_IN deve ter unidade/],
    [{ DATABASE_URL: '' }, /DATABASE_URL é obrigatória/],
  ])('rejeita %o', (override, message) => {
    expect(() => validateEnv({ ...base, ...override })).toThrow(message);
  });
});
