import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppConfigService } from '../config/app-config.service.js';
import { isAcceptedSharpFormat, UNSUPPORTED_FORMAT_MESSAGE } from './image-formats.js';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: 'image/webp';
  extension: 'webp';
  width: number;
  height: number;
  size: number;
}

/**
 * Gera a versão publicada de cada foto: corrige a rotação do celular,
 * reduz fotos muito grandes sem ampliar as pequenas, converte para WebP de alta
 * qualidade e descarta metadados (EXIF, inclusive localização GPS).
 */
@Injectable()
export class ImageProcessorService {
  constructor(private readonly config: AppConfigService) {}

  async process(input: Buffer): Promise<ProcessedImage> {
    const source = await this.decode(input);
    const { maxDimension, webpQuality } = this.config.image;

    try {
      const { data, info } = await sharp(source, { failOn: 'error' })
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: webpQuality, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });

      return {
        buffer: data,
        mimeType: 'image/webp',
        extension: 'webp',
        width: info.width,
        height: info.height,
        size: info.size,
      };
    } catch {
      throw new BadRequestException(
        'Não foi possível processar a imagem. Verifique se o arquivo não está corrompido.',
      );
    }
  }

  /**
   * Confere o formato pelo conteúdo do arquivo (não pelo MIME informado pelo
   * navegador). Ponto de extensão para decodificadores extras, como HEIC.
   */
  private async decode(input: Buffer): Promise<Buffer> {
    let format: string | undefined;
    try {
      format = (await sharp(input).metadata()).format;
    } catch {
      format = undefined;
    }
    if (!isAcceptedSharpFormat(format)) {
      throw new BadRequestException(UNSUPPORTED_FORMAT_MESSAGE);
    }
    return input;
  }
}
