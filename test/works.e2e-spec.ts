import sharp from 'sharp';
import {
  createAdmin,
  createTestApp,
  loginAsAdmin,
  resetData,
  resetWorks,
  sampleJpeg,
  stagePhoto,
  type TestContext,
} from './support/test-app.js';

/** .env.test: MAX_WORKS=3, MAX_FILE_SIZE_MB=1, IMAGE_MAX_DIMENSION=800. */
describe('Trabalhos (e2e)', () => {
  let ctx: TestContext;
  let token: string;
  let aneisId: number;
  let colaresId: number;
  let jpeg: Buffer;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  /** Fluxo completo: URL assinada → envio ao Storage → criação do trabalho. */
  const upload = async (
    title: string,
    categoryId: number,
    extra: Record<string, unknown> = {},
    status = 201,
  ) => {
    const uploadPath = await stagePhoto(ctx, token, jpeg);
    return ctx
      .http()
      .post('/admin/works')
      .set(auth())
      .send({ title, categoryId, uploadPath, ...extra })
      .expect(status);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    jpeg = await sampleJpeg();
    await resetData(ctx);
    await createAdmin(ctx);
    token = await loginAsAdmin(ctx);
    const categories = (await ctx.http().get('/categories')).body as { id: number; slug: string }[];
    aneisId = categories.find((c) => c.slug === 'aneis')!.id;
    colaresId = categories.find((c) => c.slug === 'colares')!.id;
  });

  beforeEach(() => resetWorks(ctx));

  afterAll(async () => {
    await resetData(ctx);
    await ctx.app.close();
  });

  describe('URL de upload', () => {
    it('devolve um caminho temporário e a URL assinada', async () => {
      const { body } = await ctx
        .http()
        .post('/admin/works/uploads')
        .set(auth())
        .send({ contentType: 'image/png', size: 1000 })
        .expect(201);
      expect(body.uploadPath).toMatch(/^staging\/[0-9a-f-]{36}\.png$/);
      expect(body.uploadUrl).toContain(body.uploadPath);
      expect(body.expiresInSeconds).toBe(7200);
    });

    it('recusa formato e tamanho declarados inválidos', async () => {
      const gif = await ctx
        .http()
        .post('/admin/works/uploads')
        .set(auth())
        .send({ contentType: 'image/gif', size: 1000 })
        .expect(400);
      expect(gif.body.message).toBe('Formato de arquivo não permitido. Envie JPG, PNG ou WEBP.');

      const big = await ctx
        .http()
        .post('/admin/works/uploads')
        .set(auth())
        .send({ contentType: 'image/jpeg', size: 2 * 1024 * 1024 })
        .expect(400);
      expect(big.body.message).toBe('Arquivo excede 1 MB.');
    });

    it('exige autenticação', async () => {
      await ctx.http().post('/admin/works/uploads').send({ contentType: 'image/jpeg', size: 10 }).expect(401);
    });

    it('limpa originais abandonados há mais de 1 hora', async () => {
      const old = 'staging/0b7e1c1e-2f6a-4c55-9d0e-6f1d2a3b4c5d.jpg';
      ctx.storage.putStaged(old, jpeg, new Date(Date.now() - 2 * 60 * 60 * 1000));
      await stagePhoto(ctx, token, jpeg);
      expect(ctx.storage.staged.has(old)).toBe(false);
      expect(ctx.storage.staged.size).toBe(1);
    });
  });

  describe('criação', () => {
    it('otimiza, publica com nome UUID, cria o registro e apaga o original', async () => {
      const { body } = await upload('Anel solitário', aneisId, {
        description: 'Ouro 18k · pedra natural',
        isFavorite: true,
      });

      expect(body).toMatchObject({
        id: 1,
        title: 'Anel solitário',
        description: 'Ouro 18k · pedra natural',
        categoryId: aneisId,
        category: { slug: 'aneis', name: 'Anéis' },
        isFavorite: true,
        isPublished: true,
        position: 1,
        width: 640,
        height: 800,
      });
      expect(body).not.toHaveProperty('storagePath');

      const [path] = [...ctx.storage.files.keys()];
      expect(path).toMatch(/^works\/[0-9a-f-]{36}\.webp$/);
      expect(body.imageUrl).toBe(`https://storage.test/${path}`);
      const stored = ctx.storage.files.get(path)!;
      expect(stored.contentType).toBe('image/webp');
      expect((await sharp(stored.body).metadata()).format).toBe('webp');
      expect(ctx.storage.staged.size).toBe(0);
    });

    it('confere o conteúdo real: arquivo que não é imagem é recusado e apagado', async () => {
      const uploadPath = await stagePhoto(ctx, token, Buffer.from('<script>alert(1)</script>'), {
        contentType: 'image/png',
      });
      const { body } = await ctx
        .http()
        .post('/admin/works')
        .set(auth())
        .send({ title: 'X', categoryId: aneisId, uploadPath })
        .expect(400);
      expect(body.message).toMatch(/Formato de arquivo não permitido/);
      expect(ctx.storage.files.size).toBe(0);
      expect(ctx.storage.staged.size).toBe(0);
    });

    it('confere o tamanho real, mesmo que o declarado fosse menor', async () => {
      const { body: ticket } = await ctx
        .http()
        .post('/admin/works/uploads')
        .set(auth())
        .send({ contentType: 'image/jpeg', size: 1000 })
        .expect(201);
      ctx.storage.putStaged(ticket.uploadPath, Buffer.alloc(1.2 * 1024 * 1024, 1));
      const { body } = await ctx
        .http()
        .post('/admin/works')
        .set(auth())
        .send({ title: 'Grande', categoryId: aneisId, uploadPath: ticket.uploadPath })
        .expect(400);
      expect(body.message).toBe('Arquivo excede 1 MB.');
      expect(ctx.storage.staged.size).toBe(0);
    });

    it('recusa uploadPath forjado, ausente ou não enviado', async () => {
      const forged = await ctx
        .http()
        .post('/admin/works')
        .set(auth())
        .send({ title: 'X', categoryId: aneisId, uploadPath: 'works/../../segredo.jpg' })
        .expect(400);
      expect(forged.body.details).toContain('Envio de imagem inválido. Envie a foto novamente.');

      await ctx.http().post('/admin/works').set(auth()).send({ title: 'X', categoryId: aneisId }).expect(400);

      const neverSent = await ctx
        .http()
        .post('/admin/works')
        .set(auth())
        .send({ title: 'X', categoryId: aneisId, uploadPath: 'staging/0b7e1c1e-2f6a-4c55-9d0e-6f1d2a3b4c5d.jpg' })
        .expect(400);
      expect(neverSent.body.message).toBe('A foto enviada não foi encontrada ou expirou. Envie novamente.');
    });

    it('exige título e categoria válidos', async () => {
      const noTitle = await upload('', aneisId, {}, 400);
      expect(noTitle.body.details).toContain('Informe o título.');

      const badCategory = await upload('Anel', 9999, {}, 400);
      expect(badCategory.body.message).toBe('Categoria não encontrada.');
      expect(ctx.storage.files.size).toBe(0);
    });

    it('respeita MAX_WORKS sem apagar trabalhos antigos nem deixar arquivo órfão', async () => {
      for (const title of ['A', 'B', 'C']) await upload(title, aneisId);

      const ticket = await ctx
        .http()
        .post('/admin/works/uploads')
        .set(auth())
        .send({ contentType: 'image/jpeg', size: jpeg.length })
        .expect(400);
      expect(ticket.body.message).toBe('Limite de 3 trabalhos atingido. Exclua um trabalho para cadastrar outro.');

      // Troca de foto continua permitida no limite.
      await stagePhoto(ctx, token, jpeg, { purpose: 'replace' });

      const list = await ctx.http().get('/admin/works').set(auth()).expect(200);
      expect(list.body.map((w: { title: string }) => w.title)).toEqual(['A', 'B', 'C']);
      expect(ctx.storage.files.size).toBe(3);

      const stats = await ctx.http().get('/admin/works/stats').set(auth()).expect(200);
      expect(stats.body).toMatchObject({ total: 3, maxWorks: 3, remaining: 0 });
    });
  });

  describe('edição, favoritos e publicação', () => {
    it('edita campos e substitui a imagem removendo a antiga', async () => {
      const created = (await upload('Colar', colaresId)).body;
      const [oldPath] = [...ctx.storage.files.keys()];
      const uploadPath = await stagePhoto(ctx, token, await sampleJpeg(500, 500), { purpose: 'replace' });

      const { body } = await ctx
        .http()
        .patch(`/admin/works/${created.id}`)
        .set(auth())
        .send({ title: 'Colar com pingente', categoryId: aneisId, description: '', uploadPath })
        .expect(200);

      expect(body).toMatchObject({ title: 'Colar com pingente', categoryId: aneisId, description: null, width: 500 });
      expect(ctx.storage.files.has(oldPath)).toBe(false);
      expect(ctx.storage.files.size).toBe(1);
      expect(ctx.storage.staged.size).toBe(0);
      expect(body.imageUrl).not.toContain(oldPath);
    });

    it('edita sem trocar a imagem', async () => {
      const created = (await upload('Anel', aneisId)).body;
      const { body } = await ctx
        .http()
        .patch(`/admin/works/${created.id}`)
        .set(auth())
        .send({ title: 'Anel maciço', isPublished: false })
        .expect(200);
      expect(body).toMatchObject({ title: 'Anel maciço', isPublished: false });
    });

    it('favorita, oculta e reflete nas estatísticas e no site público', async () => {
      const a = (await upload('Visível', aneisId)).body;
      const b = (await upload('Oculta', colaresId)).body;

      await ctx.http().patch(`/admin/works/${a.id}/favorite`).set(auth()).send({ isFavorite: true }).expect(200);
      const hidden = await ctx
        .http()
        .patch(`/admin/works/${b.id}/publish`)
        .set(auth())
        .send({ isPublished: false })
        .expect(200);
      expect(hidden.body.isPublished).toBe(false);

      const stats = await ctx.http().get('/admin/works/stats').set(auth()).expect(200);
      expect(stats.body).toMatchObject({ total: 2, favorites: 1, hidden: 1, published: 1 });

      const publicList = await ctx.http().get('/works').expect(200);
      expect(publicList.body.items.map((w: { title: string }) => w.title)).toEqual(['Visível']);
      expect(publicList.body.items[0]).not.toHaveProperty('isPublished');
      expect(publicList.body.items[0]).not.toHaveProperty('storagePath');
      await ctx.http().get(`/works/${b.id}`).expect(404);
      await ctx.http().get(`/works/${a.id}`).expect(200);
    });

    it('valida o corpo de favorito/publicação e retorna 404 para id inexistente', async () => {
      await ctx.http().patch('/admin/works/1/favorite').set(auth()).send({ isFavorite: 'talvez' }).expect(400);
      const { body } = await ctx
        .http()
        .patch('/admin/works/999/publish')
        .set(auth())
        .send({ isPublished: true })
        .expect(404);
      expect(body.message).toBe('Trabalho não encontrado.');
    });
  });

  describe('ordenação, filtro e exclusão', () => {
    it('reordena e mantém a ordem após recarregar', async () => {
      const a = (await upload('A', aneisId)).body;
      const b = (await upload('B', colaresId)).body;
      const c = (await upload('C', aneisId)).body;

      await ctx
        .http()
        .patch('/admin/works/reorder')
        .set(auth())
        .send({ items: [{ id: c.id, position: 1 }, { id: a.id, position: 2 }, { id: b.id, position: 3 }] })
        .expect(200);

      const admin = await ctx.http().get('/admin/works').set(auth()).expect(200);
      expect(admin.body.map((w: { title: string }) => w.title)).toEqual(['C', 'A', 'B']);
      const publicList = await ctx.http().get('/works').expect(200);
      expect(publicList.body.items.map((w: { title: string }) => w.title)).toEqual(['C', 'A', 'B']);

      const incomplete = await ctx
        .http()
        .patch('/admin/works/reorder')
        .set(auth())
        .send({ items: [{ id: a.id, position: 1 }] })
        .expect(400);
      expect(incomplete.body.message).toBe('A lista de ordenação deve conter todos os trabalhos cadastrados.');
    });

    it('filtra por categoria (público e admin) e pagina', async () => {
      await upload('Anel 1', aneisId);
      await upload('Colar', colaresId);
      await upload('Anel 2', aneisId);

      const aneis = await ctx.http().get('/works?category=aneis').expect(200);
      expect(aneis.body.items.map((w: { title: string }) => w.title)).toEqual(['Anel 1', 'Anel 2']);
      expect(aneis.body.meta).toEqual({ page: 1, limit: 50, total: 2, totalPages: 1 });

      const page2 = await ctx.http().get('/works?limit=2&page=2').expect(200);
      expect(page2.body.items.map((w: { title: string }) => w.title)).toEqual(['Anel 2']);

      const admin = await ctx.http().get('/admin/works?category=colares').set(auth()).expect(200);
      expect(admin.body.map((w: { title: string }) => w.title)).toEqual(['Colar']);

      const unknown = await ctx.http().get('/works?category=nao-existe').expect(200);
      expect(unknown.body.items).toEqual([]);
    });

    it('exclui o arquivo e o registro e fecha a lacuna de posições', async () => {
      const a = (await upload('A', aneisId)).body;
      await upload('B', aneisId);
      await upload('C', aneisId);

      await ctx.http().delete(`/admin/works/${a.id}`).set(auth()).expect(204);

      const list = await ctx.http().get('/admin/works').set(auth()).expect(200);
      expect(list.body.map((w: { title: string; position: number }) => [w.title, w.position])).toEqual([
        ['B', 1],
        ['C', 2],
      ]);
      expect(ctx.storage.files.size).toBe(2);
      await ctx.http().delete(`/admin/works/${a.id}`).set(auth()).expect(404);
    });

    it('exclui o registro mesmo se o arquivo já não existir no Storage', async () => {
      const a = (await upload('A', aneisId)).body;
      ctx.storage.files.clear();

      await ctx.http().delete(`/admin/works/${a.id}`).set(auth()).expect(204);
      const list = await ctx.http().get('/admin/works').set(auth()).expect(200);
      expect(list.body).toEqual([]);
    });
  });

  describe('corpo da requisição', () => {
    it('JSON malformado responde 400 no formato padrão', async () => {
      const { body } = await ctx
        .http()
        .patch('/admin/works/reorder')
        .set(auth())
        .set('Content-Type', 'application/json')
        .send('{"items": [')
        .expect(400);
      expect(body).toMatchObject({ statusCode: 400, path: '/admin/works/reorder' });
      expect(typeof body.message).toBe('string');
    });
  });
});
