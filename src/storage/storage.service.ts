import type {
  SignedUpload,
  StagedFile,
  StorageProvider,
  StoredFile,
  UploadFileInput,
} from './storage.interface.js';

/**
 * Token de injeção do armazenamento. Interfaces não existem em runtime, então
 * os serviços injetam esta classe abstrata e o StorageModule escolhe a implementação.
 */
export abstract class StorageService implements StorageProvider {
  abstract upload(input: UploadFileInput): Promise<StoredFile>;
  abstract delete(path: string): Promise<void>;
  abstract getPublicUrl(path: string): string;
  abstract createStagingUpload(path: string): Promise<SignedUpload>;
  abstract downloadStaged(path: string): Promise<Buffer | null>;
  abstract deleteStaged(paths: string[]): Promise<void>;
  abstract listStaged(): Promise<StagedFile[]>;
}
