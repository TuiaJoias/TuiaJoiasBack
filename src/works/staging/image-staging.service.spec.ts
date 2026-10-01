import type { AppConfigService } from '../../config/app-config.service.js';
import type { StorageService } from '../../storage/storage.service.js';
import { ImageStagingService } from './image-staging.service.js';
import { STAGING_PATH_PATTERN } from './staging-path.js';

const MB = 1024 * 1024;
const config = { upload: { maxFileSizeMb: 25, maxFileSizeBytes: 25 * MB } } as AppConfigService;
const VALID_PATH = 'staging/0b7e1c1e-2f6a-4c55-9d0e-6f1d2a3b4c5d.png';

describe('ImageStagingService', () => {
  let storage: Record<string, ReturnType<typeof vi.fn>>;
  let service: ImageStagingService;

  beforeEach(() => {
    storage = {
      createStagingUpload: vi.fn(async (path: string) => ({ path, uploadUrl: `https://up/${path}`, expiresInSeconds: 7200 })),
      downloadStaged: vi.fn().mockResolvedValue(Buffer.from('png')),
      deleteStaged: vi.fn().mockResolvedValue(undefined),
      listStaged: vi.fn().mockResolvedValue([]),
    };
    service = new ImageStagingService(storage as unknown as StorageService, config);
  });

  describe('createUpload', () => {
    it('gera um caminho único na área temporária com a extensão do formato', async () => {
      const upload = await service.createUpload('image/jpeg', 3 * MB);
      expect(upload.path).toMatch(STAGING_PATH_PATTERN);
      expect(upload.path).toMatch(/\.jpg$/);
    });

    it('recusa formato não permitido', async () => {
      await expect(service.createUpload('image/gif', 10)).rejects.toThrow(/Formato de arquivo não permitido/);
      expect(storage.createStagingUpload).not.toHaveBeenCalled();
    });

    it('recusa tamanho declarado acima do limite', async () => {
      await expect(service.createUpload('image/png', 26 * MB)).rejects.toThrow('Arquivo excede 25 MB.');
    });

    it('remove originais abandonados há mais de 1 hora', async () => {
      const old = { path: 'staging/a.jpg', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) };
      const recent = { path: 'staging/b.jpg', createdAt: new Date() };
      storage.listStaged.mockResolvedValue([old, recent]);

      await service.createUpload('image/png', 10);

      expect(storage.deleteStaged).toHaveBeenCalledWith(['staging/a.jpg']);
    });

    it('falha na limpeza não impede o envio', async () => {
      storage.listStaged.mockRejectedValue(new Error('storage down'));
      await expect(service.createUpload('image/png', 10)).resolves.toBeDefined();
    });
  });

  describe('consume', () => {
    it('devolve o original e o remove da área temporária', async () => {
      await expect(service.consume(VALID_PATH)).resolves.toEqual(Buffer.from('png'));
      expect(storage.deleteStaged).toHaveBeenCalledWith([VALID_PATH]);
    });

    it.each(['works/0b7e1c1e-2f6a-4c55-9d0e-6f1d2a3b4c5d.webp', 'staging/../works/x.jpg', 'staging/abc.jpg'])(
      'recusa caminho fora do padrão: %s',
      async (path) => {
        await expect(service.consume(path)).rejects.toThrow(/Envio de imagem inválido/);
        expect(storage.downloadStaged).not.toHaveBeenCalled();
      },
    );

    it('avisa quando o arquivo não foi enviado ou expirou', async () => {
      storage.downloadStaged.mockResolvedValue(null);
      await expect(service.consume(VALID_PATH)).rejects.toThrow(/não foi encontrada ou expirou/);
    });

    it('confere o tamanho real e remove o arquivo grande', async () => {
      storage.downloadStaged.mockResolvedValue(Buffer.alloc(25 * MB + 1));
      await expect(service.consume(VALID_PATH)).rejects.toThrow('Arquivo excede 25 MB.');
      expect(storage.deleteStaged).toHaveBeenCalledWith([VALID_PATH]);
    });
  });
});
