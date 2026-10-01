import {
  createAdmin,
  createTestApp,
  loginAsAdmin,
  resetData,
  sampleJpeg,
  stagePhoto,
  type TestContext,
} from './support/test-app.js';

describe('Categorias (e2e)', () => {
  let ctx: TestContext;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetData(ctx);
    await createAdmin(ctx);
    token = await loginAsAdmin(ctx);
  });

  afterAll(async () => {
    await ctx.dataSource.query('TRUNCATE works RESTART IDENTITY');
    await ctx.dataSource.query(`DELETE FROM categories WHERE slug NOT IN
      ('correntes','aneis','pulseiras','colares','pingentes','aliancas','restauracao')`);
    await ctx.app.close();
  });

  it('lista as categorias iniciais publicamente, na ordem do seed', async () => {
    const { body } = await ctx.http().get('/categories').expect(200);
    expect(body.map((c: { name: string }) => c.name)).toEqual([
      'Correntes',
      'Anéis',
      'Pulseiras',
      'Colares',
      'Pingentes',
      'Alianças',
      'Restauração',
    ]);
    expect(body[1]).toEqual({ id: expect.any(Number), name: 'Anéis', slug: 'aneis' });
  });

  it('cria, renomeia e exclui uma categoria', async () => {
    const created = await ctx.http().post('/admin/categories').set(auth()).send({ name: 'Brincos Únicos' }).expect(201);
    expect(created.body.slug).toBe('brincos-unicos');

    const renamed = await ctx
      .http()
      .patch(`/admin/categories/${created.body.id}`)
      .set(auth())
      .send({ name: 'Brincos' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Brincos', slug: 'brincos-unicos' });

    await ctx.http().delete(`/admin/categories/${created.body.id}`).set(auth()).expect(204);
    await ctx.http().patch(`/admin/categories/${created.body.id}`).set(auth()).send({ name: 'X' }).expect(404);
  });

  it('impede nome ou slug duplicado', async () => {
    const { body } = await ctx.http().post('/admin/categories').set(auth()).send({ name: 'Anéis' }).expect(409);
    expect(body.message).toBe('Já existe uma categoria com esse nome ou slug.');
  });

  it('impede excluir categoria com trabalhos vinculados', async () => {
    const category = await ctx.http().post('/admin/categories').set(auth()).send({ name: 'Broches' }).expect(201);
    const uploadPath = await stagePhoto(ctx, token, await sampleJpeg(300, 300));
    await ctx
      .http()
      .post('/admin/works')
      .set(auth())
      .send({ title: 'Broche', categoryId: category.body.id, uploadPath })
      .expect(201);

    const { body } = await ctx.http().delete(`/admin/categories/${category.body.id}`).set(auth()).expect(409);
    expect(body.message).toMatch(/categoria com trabalhos/);
  });
});
