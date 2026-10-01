import { SIGNED_UPLOAD_TTL_SECONDS } from '../../src/storage/storage.constants.js';
import type {
  SignedUpload,
  StagedFile,
  StoredFile,
  UploadFileInput,
} from '../../src/storage/storage.interface.js';
import { StorageService } from '../../src/storage/storage.service.js';

/** Implementação de teste do StorageService: prova que a aplicação só depende da abstração. */
export class InMemoryStorageService extends StorageService {
  /** Bucket público (imagens otimizadas). */
  readonly files = new Map<string, UploadFileInput>();
  /** Bucket privado (originais enviados pelo "navegador"). */
  readonly staged = new Map<string, { body: Buffer; createdAt: Date }>();

  async upload(input: UploadFileInput): Promise<StoredFile> {
    this.files.set(input.path, input);
    return { path: input.path, publicUrl: this.getPublicUrl(input.path) };
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  getPublicUrl(path: string): string {
    return `https://storage.test/${path}`;
  }

  async createStagingUpload(path: string): Promise<SignedUpload> {
    return {
      path,
      uploadUrl: `https://storage.test/upload/${path}?token=fake`,
      expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS,
    };
  }

  async downloadStaged(path: string): Promise<Buffer | null> {
    return this.staged.get(path)?.body ?? null;
  }

  async deleteStaged(paths: string[]): Promise<void> {
    paths.forEach((path) => this.staged.delete(path));
  }

  async listStaged(): Promise<StagedFile[]> {
    return [...this.staged].map(([path, { createdAt }]) => ({ path, createdAt }));
  }

  /** Simula o PUT que o navegador faz na URL assinada. */
  putStaged(path: string, body: Buffer, createdAt = new Date()): void {
    this.staged.set(path, { body, createdAt });
  }

  clear(): void {
    this.files.clear();
    this.staged.clear();
  }
}
