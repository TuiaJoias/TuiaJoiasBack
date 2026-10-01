import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import type { CategoriesService } from '../categories/categories.service.js';
import type { AppConfigService } from '../config/app-config.service.js';
import type { ImageProcessorService, ProcessedImage } from '../images/image-processor.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { UploadPurpose } from './dto/create-upload.dto.js';
import type { Work } from './entities/work.entity.js';
import type { ImageStagingService } from './staging/image-staging.service.js';
import { WorksService } from './works.service.js';

const processed: ProcessedImage = {
  buffer: Buffer.from('webp'),
  mimeType: 'image/webp',
  extension: 'webp',
  width: 800,
  height: 1000,
  size: 4,
};

const UPLOAD_PATH = 'staging/0b7e1c1e-2f6a-4c55-9d0e-6f1d2a3b4c5d.jpg';
const original = Buffer.from('jpeg');

function existingWork(overrides: Partial<Work> = {}): Work {
  return {
    id: 1,
    title: 'Anel',
    description: null,
    categoryId: 2,
    imageUrl: 'https://cdn/works/old.webp',
    storagePath: 'works/old.webp',
    width: 100,
    height: 100,
    isFavorite: false,
    isPublished: true,
    position: 1,
    ...overrides,
  } as Work;
}

describe('WorksService', () => {
  let manager: Record<string, ReturnType<typeof vi.fn>>;
  let repository: Record<string, unknown>;
  let storage: Record<string, ReturnType<typeof vi.fn>>;
  let images: { process: ReturnType<typeof vi.fn> };
  let categories: { assertExists: ReturnType<typeof vi.fn> };
  let staging: { consume: ReturnType<typeof vi.fn>; createUpload: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let service: WorksService;
  const config = { maxWorks: 15, upload: { maxFileSizeMb: 25 } } as AppConfigService;

  beforeEach(() => {
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ max: 4 }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({}),
    };
    manager = {
      query: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((_entity, data) => data),
      save: vi.fn(async (data) => ({ ...data, id: 10 })),
      createQueryBuilder: vi.fn(() => queryBuilder),
      findOneBy: vi.fn(),
      delete: vi.fn(),
      find: vi.fn(),
      update: vi.fn(),
    };
    repository = {
      manager,
      findOne: vi.fn().mockResolvedValue(existingWork()),
      find: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    storage = {
      upload: vi.fn(async ({ path }) => ({ path, publicUrl: `https://cdn/${path}` })),
      delete: vi.fn().mockResolvedValue(undefined),
      getPublicUrl: vi.fn(),
    };
    images = { process: vi.fn().mockResolvedValue(processed) };
    categories = { assertExists: vi.fn().mockResolvedValue(undefined) };
    staging = {
      consume: vi.fn().mockResolvedValue(original),
      createUpload: vi.fn(async () => ({ path: UPLOAD_PATH, uploadUrl: 'https://x', expiresInSeconds: 7200 })),
    };
    dataSource = {
      transaction: vi.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
      ),
    };
    service = new WorksService(
      repository as unknown as Repository<Work>,
      dataSource as unknown as DataSource,
      categories as unknown as CategoriesService,
      images as unknown as ImageProcessorService,
      storage as unknown as StorageService,
      staging as unknown as ImageStagingService,
      config,
    );
  });

  describe('prepareUpload', () => {
    it('bloqueia foto nova quando MAX_WORKS foi atingido', async () => {
      manager.count.mockResolvedValue(15);
      await expect(
        service.prepareUpload({ contentType: 'image/jpeg', size: 10, purpose: UploadPurpose.Create }),
      ).rejects.toThrow(/Limite de 15 trabalhos atingido/);
      expect(staging.createUpload).not.toHaveBeenCalled();
    });

    it('troca de foto não conta para o limite', async () => {
      manager.count.mockResolvedValue(15);
      await service.prepareUpload({ contentType: 'image/jpeg', size: 10, purpose: UploadPurpose.Replace });
      expect(staging.createUpload).toHaveBeenCalledWith('image/jpeg', 10);
    });
  });

  describe('create', () => {
    const dto = { title: 'Anel solitário', categoryId: 2, uploadPath: UPLOAD_PATH };

    it('lê o original enviado, publica o WebP com nome UUID e grava no fim da ordem', async () => {
      await service.create(dto);

      expect(staging.consume).toHaveBeenCalledWith(UPLOAD_PATH);
      expect(images.process).toHaveBeenCalledWith(original);

      const [{ path, contentType }] = storage.upload.mock.calls[0];
      expect(path).toMatch(/^works\/[0-9a-f-]{36}\.webp$/);
      expect(contentType).toBe('image/webp');
      expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', [
        expect.any(Number),
      ]);
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ position: 5, width: 800, height: 1000, storagePath: path }),
      );
    });

    it('bloqueia quando MAX_WORKS foi atingido, sem processar nem publicar nada', async () => {
      manager.count.mockResolvedValue(15);
      await expect(service.create(dto)).rejects.toThrow(/Limite de 15 trabalhos atingido/);
      expect(staging.consume).not.toHaveBeenCalled();
      expect(images.process).not.toHaveBeenCalled();
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('remove o arquivo enviado se a gravação no banco falhar', async () => {
      manager.save.mockRejectedValue(new Error('db down'));
      await expect(service.create(dto)).rejects.toThrow('db down');

      const uploadedPath = storage.upload.mock.calls[0][0].path;
      expect(storage.delete).toHaveBeenCalledWith(uploadedPath);
    });

    it('remove o arquivo se o limite for atingido por um upload concorrente', async () => {
      manager.count.mockResolvedValueOnce(14).mockResolvedValueOnce(15);
      await expect(service.create(dto)).rejects.toThrow(/Limite/);
      expect(storage.delete).toHaveBeenCalledWith(storage.upload.mock.calls[0][0].path);
    });
  });

  describe('update com nova imagem', () => {
    it('salva a nova, atualiza o banco e só então remove a antiga', async () => {
      const order: string[] = [];
      storage.upload.mockImplementation(async ({ path }) => {
        order.push('upload');
        return { path, publicUrl: `https://cdn/${path}` };
      });
      (repository.update as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push('db');
        return { affected: 1 };
      });
      storage.delete.mockImplementation(async (path: string) => {
        order.push(`delete:${path}`);
      });

      await service.update(1, { title: 'Novo', uploadPath: UPLOAD_PATH });

      expect(order).toEqual(['upload', 'db', 'delete:works/old.webp']);
    });

    it('mantém a imagem antiga e remove a nova se o banco falhar', async () => {
      (repository.update as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'));

      await expect(service.update(1, { uploadPath: UPLOAD_PATH })).rejects.toThrow('db down');

      const newPath = storage.upload.mock.calls[0][0].path;
      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete).toHaveBeenCalledWith(newPath);
    });
  });

  describe('remove', () => {
    it('exclui o registro, fecha a lacuna de posições e remove o arquivo', async () => {
      manager.findOneBy.mockResolvedValue(existingWork({ position: 3 }));

      await service.remove(1);

      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), { id: 1 });
      expect(storage.delete).toHaveBeenCalledWith('works/old.webp');
    });

    it('propaga falha do Storage para desfazer a transação', async () => {
      manager.findOneBy.mockResolvedValue(existingWork());
      storage.delete.mockRejectedValue(new Error('storage down'));

      await expect(service.remove(1)).rejects.toThrow('storage down');
    });

    it('retorna 404 para trabalho inexistente', async () => {
      manager.findOneBy.mockResolvedValue(null);
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    beforeEach(() => {
      manager.find.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('grava todas as posições dentro da transação', async () => {
      await service.reorder({
        items: [
          { id: 3, position: 1 },
          { id: 1, position: 2 },
          { id: 2, position: 3 },
        ],
      });
      expect(manager.update).toHaveBeenCalledTimes(3);
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 3 }, { position: 1 });
    });

    it.each([
      ['ids repetidos', [{ id: 1, position: 1 }, { id: 1, position: 2 }, { id: 2, position: 3 }]],
      ['posições fora da sequência', [{ id: 1, position: 1 }, { id: 2, position: 2 }, { id: 3, position: 5 }]],
      ['lista incompleta', [{ id: 1, position: 1 }, { id: 2, position: 2 }]],
      ['id desconhecido', [{ id: 1, position: 1 }, { id: 2, position: 2 }, { id: 9, position: 3 }]],
    ])('rejeita %s', async (_case, items) => {
      await expect(service.reorder({ items })).rejects.toBeInstanceOf(BadRequestException);
      expect(manager.update).not.toHaveBeenCalled();
    });
  });
});
