import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../../config/app-config.service.js';
import { extensionForMimeType, UNSUPPORTED_FORMAT_MESSAGE } from '../../images/image-formats.js';
import { STAGING_FOLDER } from '../../storage/storage.constants.js';
import type { SignedUpload } from '../../storage/storage.interface.js';
import { StorageService } from '../../storage/storage.service.js';
import { INVALID_UPLOAD_MESSAGE, STAGING_PATH_PATTERN } from './staging-path.js';

/** Originais parados há mais que isso foram abandonados (o envio leva segundos). */
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Área temporária do upload direto: o navegador envia o original ao bucket
 * privado e a API o lê daqui para validar e otimizar. Assim o arquivo nunca
 * passa pelo corpo da requisição da API (limite de 4,5 MB na Vercel).
 */
@Injectable()
export class ImageStagingService {
  private readonly logger = new Logger(ImageStagingService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {}

  /** Valida o que o navegador declarou e devolve a URL assinada de envio. */
  async createUpload(contentType: string, size: number): Promise<SignedUpload> {
    const extension = extensionForMimeType(contentType);
    if (!extension) {
      throw new BadRequestException(UNSUPPORTED_FORMAT_MESSAGE);
    }
    this.assertSize(size);
    await this.removeStale();
    return this.storage.createStagingUpload(`${STAGING_FOLDER}/${randomUUID()}.${extension}`);
  }

  /**
   * Lê o original enviado e já o remove da área temporária. O tamanho é
   * conferido de novo aqui: não confiamos no valor declarado pelo navegador.
   */
  async consume(path: string): Promise<Buffer> {
    if (!STAGING_PATH_PATTERN.test(path)) {
      throw new BadRequestException(INVALID_UPLOAD_MESSAGE);
    }
    try {
      const file = await this.storage.downloadStaged(path);
      if (!file) {
        throw new BadRequestException('A foto enviada não foi encontrada ou expirou. Envie novamente.');
      }
      this.assertSize(file.length);
      return file;
    } finally {
      await this.discard([path]);
    }
  }

  private assertSize(bytes: number): void {
    const { maxFileSizeBytes, maxFileSizeMb } = this.config.upload;
    if (bytes > maxFileSizeBytes) {
      throw new BadRequestException(`Arquivo excede ${maxFileSizeMb} MB.`);
    }
  }

  /** Limpeza oportunista dos envios abandonados (dispensa um cron). */
  private async removeStale(): Promise<void> {
    try {
      const limit = Date.now() - STALE_AFTER_MS;
      const stale = (await this.storage.listStaged())
        .filter((file) => file.createdAt.getTime() < limit)
        .map((file) => file.path);
      await this.discard(stale);
    } catch (error) {
      this.logger.warn(`Limpeza de temporários falhou: ${(error as Error).message}`);
    }
  }

  private async discard(paths: string[]): Promise<void> {
    if (!paths.length) return;
    try {
      await this.storage.deleteStaged(paths);
    } catch (error) {
      this.logger.warn(`Não foi possível remover temporários: ${(error as Error).message}`);
    }
  }
}
