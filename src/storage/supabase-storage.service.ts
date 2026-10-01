import {
  BadGatewayException,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppConfigService } from '../config/app-config.service.js';
import { SIGNED_UPLOAD_TTL_SECONDS, STAGING_FOLDER } from './storage.constants.js';
import type { SignedUpload, StagedFile, StoredFile, UploadFileInput } from './storage.interface.js';
import { StorageService } from './storage.service.js';

/** Nomes são UUID e nunca reutilizados, então o cache pode ser longo (1 ano). */
const CACHE_CONTROL_SECONDS = '31536000';

const SAVE_ERROR = 'Não foi possível salvar a imagem. Tente novamente.';
const REMOVE_ERROR = 'Não foi possível remover a imagem. Tente novamente.';
const STAGING_ERROR = 'Não foi possível preparar o envio da imagem. Tente novamente.';

function isNotFound(error: { message?: string; statusCode?: string | number }): boolean {
  return String(error.statusCode) === '404' || /not.?found/i.test(error.message ?? '');
}

@Injectable()
export class SupabaseStorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: SupabaseClient | null;
  private readonly bucket: string;
  private readonly uploadsBucket: string;

  constructor(config: AppConfigService) {
    super();
    const { url, serviceRoleKey, bucket, uploadsBucket } = config.supabase;
    this.bucket = bucket;
    this.uploadsBucket = uploadsBucket;
    this.client =
      url && serviceRoleKey
        ? createClient(url, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          })
        : null;
  }

  onModuleInit(): void {
    if (!this.client) {
      this.logger.warn(
        'Supabase Storage não configurado: uploads responderão 503. Veja docs/SUPABASE.md.',
      );
    }
  }

  // ---- Bucket público ------------------------------------------------------

  async upload({ path, body, contentType }: UploadFileInput): Promise<StoredFile> {
    const { error } = await this.from(this.bucket).upload(path, body, {
      contentType,
      cacheControl: CACHE_CONTROL_SECONDS,
      upsert: false,
    });
    if (error) {
      this.logger.error(`Falha ao enviar ${path}: ${error.message}`);
      throw new BadGatewayException(SAVE_ERROR);
    }
    return { path, publicUrl: this.getPublicUrl(path) };
  }

  async delete(path: string): Promise<void> {
    // O Supabase não retorna erro ao remover um arquivo inexistente.
    const { error } = await this.from(this.bucket).remove([path]);
    if (error) {
      this.logger.error(`Falha ao remover ${path}: ${error.message}`);
      throw new BadGatewayException(REMOVE_ERROR);
    }
  }

  getPublicUrl(path: string): string {
    return this.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  // ---- Bucket privado (área temporária) ------------------------------------

  async createStagingUpload(path: string): Promise<SignedUpload> {
    const { data, error } = await this.from(this.uploadsBucket).createSignedUploadUrl(path);
    if (error || !data) {
      this.logger.error(`Falha ao criar URL de upload para ${path}: ${error?.message}`);
      throw new BadGatewayException(STAGING_ERROR);
    }
    return { path, uploadUrl: data.signedUrl, expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS };
  }

  async downloadStaged(path: string): Promise<Buffer | null> {
    const { data, error } = await this.from(this.uploadsBucket).download(path);
    if (error) {
      if (isNotFound(error as { message?: string; statusCode?: string })) return null;
      this.logger.error(`Falha ao baixar ${path}: ${error.message}`);
      throw new BadGatewayException(SAVE_ERROR);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteStaged(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.from(this.uploadsBucket).remove(paths);
    if (error) {
      this.logger.error(`Falha ao remover temporários: ${error.message}`);
      throw new BadGatewayException(REMOVE_ERROR);
    }
  }

  async listStaged(): Promise<StagedFile[]> {
    const { data, error } = await this.from(this.uploadsBucket).list(STAGING_FOLDER, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' },
    });
    if (error) {
      this.logger.error(`Falha ao listar temporários: ${error.message}`);
      throw new BadGatewayException(STAGING_ERROR);
    }
    return data
      .filter((item) => item.id) // ignora "pastas"
      .map((item) => ({
        path: `${STAGING_FOLDER}/${item.name}`,
        createdAt: new Date(item.created_at ?? 0),
      }));
  }

  private from(bucket: string) {
    if (!this.client) {
      throw new ServiceUnavailableException('Armazenamento de imagens não configurado.');
    }
    return this.client.storage.from(bucket);
  }
}
