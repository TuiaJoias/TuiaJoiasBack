import { ADMIN, createAdmin, createTestApp, resetData, type TestContext } from './support/test-app.js';

describe('Autenticação (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetData(ctx);
    await createAdmin(ctx);
  });

  afterAll(() => ctx.app.close());

  it('faz login e retorna token sem passwordHash', async () => {
    const { body } = await ctx
      .http()
      .post('/auth/login')
      .send({ email: ADMIN.email.toUpperCase(), password: ADMIN.password })
      .expect(200);

    expect(body).toMatchObject({ tokenType: 'Bearer', user: { email: ADMIN.email, name: ADMIN.name } });
    expect(body.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toMatch(/password/i);

    const me = await ctx.http().get('/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
    expect(me.body).toEqual({ id: 1, name: ADMIN.name, email: ADMIN.email });
  });

  it('recusa credenciais inválidas', async () => {
    const { body } = await ctx
      .http()
      .post('/auth/login')
      .send({ email: ADMIN.email, password: 'senha-errada' })
      .expect(401);
    expect(body).toMatchObject({ statusCode: 401, message: 'Credenciais inválidas.' });
  });

  it('valida o corpo do login', async () => {
    const { body } = await ctx.http().post('/auth/login').send({ email: 'x', extra: 1 }).expect(400);
    expect(body.message).toBe('Dados inválidos.');
    expect(body.details).toEqual(
      expect.arrayContaining(['Informe um email válido.', 'Campo não permitido: extra.']),
    );
  });

  it.each(['/admin/works', '/admin/works/stats', '/admin/categories', '/auth/me'])(
    'bloqueia %s sem token',
    async (path) => {
      const { body } = await ctx.http().get(path).expect(401);
      expect(body.message).toBe('Token ausente ou inválido.');
    },
  );

  it('bloqueia alterações administrativas sem token', async () => {
    await ctx.http().patch('/admin/works/1/favorite').send({ isFavorite: true }).expect(401);
    await ctx.http().delete('/admin/works/1').expect(401);
    await ctx.http().post('/admin/categories').send({ name: 'X' }).expect(401);
  });

  it('limita tentativas de login (último teste: esgota o limite)', async () => {
    const attempt = () =>
      ctx.http().post('/auth/login').send({ email: ADMIN.email, password: 'errada-de-novo' });
    for (let i = 0; i < 3; i++) await attempt();
    const { body } = await attempt().expect(429);
    expect(body.message).toMatch(/Muitas tentativas/);
  });
});
