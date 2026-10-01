import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { hashPassword } from '../../src/auth/password.js';
import { StorageService } from '../../src/storage/storage.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { InMemoryStorageService } from './in-memory-storage.js';

export const ADMIN = {
  name: 'Ourives Teste',
  email: 'admin@tuiajoias.test',
  password: 'senha-de-teste-segura',
};

export interface TestContext {
  app: INestApplication<App>;
  storage: InMemoryStorageService;
  dataSource: DataSource;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const storage = new InMemoryStorageService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: ['error'] });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  return { app, storage, dataSource, http: () => request(app.getHttpServer()) };
}

/** Limpa trabalhos e usuários (as categorias do seed permanecem). */
export async function resetData(ctx: TestContext): Promise<void> {
  await ctx.dataSource.query('TRUNCATE works, users RESTART IDENTITY CASCADE');
  ctx.storage.clear();
}

/** Limpa só os trabalhos, mantendo o admin logado (evita o rate limit do login). */
export async function resetWorks(ctx: TestContext): Promise<void> {
  await ctx.dataSource.query('TRUNCATE works RESTART IDENTITY');
  ctx.storage.clear();
}

export async function createAdmin(ctx: TestContext): Promise<void> {
  await ctx.dataSource.getRepository(User).insert({
    name: ADMIN.name,
    email: ADMIN.email,
    passwordHash: await hashPassword(ADMIN.password),
  });
}

export async function loginAsAdmin(ctx: TestContext): Promise<string> {
  const response = await ctx
    .http()
    .post('/auth/login')
    .send({ email: ADMIN.email, password: ADMIN.password })
    .expect(200);
  return response.body.accessToken as string;
}

export function sampleJpeg(width = 1200, height = 1500): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#b08d4a' } })
    .jpeg()
    .toBuffer();
}

/**
 * Etapas 1 e 2 do upload direto: pede a URL assinada e "envia" o arquivo para
 * a área temporária, como o navegador faria. Retorna o uploadPath.
 */
export async function stagePhoto(
  ctx: TestContext,
  token: string,
  body: Buffer,
  { contentType = 'image/jpeg', purpose = 'create' }: { contentType?: string; purpose?: string } = {},
): Promise<string> {
  const { body: ticket } = await ctx
    .http()
    .post('/admin/works/uploads')
    .set('Authorization', `Bearer ${token}`)
    .send({ contentType, size: body.length, purpose })
    .expect(201);
  ctx.storage.putStaged(ticket.uploadPath, body);
  return ticket.uploadPath as string;
}
