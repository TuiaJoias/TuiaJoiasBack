import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import type { AppConfigService } from '../config/app-config.service.js';
import { ImageProcessorService } from './image-processor.service.js';

const config = { image: { maxDimension: 1000, webpQuality: 80 } } as AppConfigService;

function solidImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#c9a85c' } });
}

describe('ImageProcessorService', () => {
  const processor = new ImageProcessorService(config);

  it('converte para WebP e reduz imagens grandes mantendo a proporção', async () => {
    const input = await solidImage(3000, 2000).jpeg().toBuffer();
    const result = await processor.process(input);

    expect(result.mimeType).toBe('image/webp');
    expect(result.extension).toBe('webp');
    expect([result.width, result.height]).toEqual([1000, 667]);
    expect((await sharp(result.buffer).metadata()).format).toBe('webp');
  });

  it('não amplia imagens menores que o limite', async () => {
    const input = await solidImage(400, 300).png().toBuffer();
    const result = await processor.process(input);
    expect([result.width, result.height]).toEqual([400, 300]);
  });

  it('aplica a rotação do EXIF e descarta os metadados', async () => {
    const input = await solidImage(200, 100)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processor.process(input);
    const metadata = await sharp(result.buffer).metadata();

    expect([result.width, result.height]).toEqual([100, 200]);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it('rejeita arquivos que não são imagem, mesmo com MIME de imagem', async () => {
    await expect(processor.process(Buffer.from('não sou uma imagem'))).rejects.toThrow(
      /Formato de arquivo não permitido/,
    );
  });

  it('rejeita formatos de imagem fora da lista aceita (GIF)', async () => {
    const gif = await solidImage(10, 10).gif().toBuffer();
    await expect(processor.process(gif)).rejects.toBeInstanceOf(BadRequestException);
  });
});
