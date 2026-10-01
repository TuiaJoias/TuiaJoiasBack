/**
 * Formatos de entrada aceitos. Para adicionar um formato, inclua uma entrada
 * aqui; o upload (MIME) e o processador (conteúdo real) usam esta lista.
 *
 * HEIC/HEIF (futuro): o Sharp pré-compilado não decodifica HEIC (codec HEVC).
 * Para habilitar, adicione
 *   { label: 'HEIC', extension: 'heic', mimeTypes: ['image/heic', 'image/heif'], sharpFormats: ['heif'] }
 * e converta o buffer para JPEG antes do Sharp em ImageProcessorService.decode()
 * (ex.: com o pacote heic-convert).
 */
export interface InputImageFormat {
  label: string;
  /** Extensão usada no nome do original enviado pelo navegador. */
  extension: string;
  mimeTypes: string[];
  /** Valores de `sharp().metadata().format` correspondentes. */
  sharpFormats: string[];
}

export const INPUT_IMAGE_FORMATS: InputImageFormat[] = [
  {
    label: 'JPG',
    extension: 'jpg',
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    sharpFormats: ['jpeg'],
  },
  { label: 'PNG', extension: 'png', mimeTypes: ['image/png'], sharpFormats: ['png'] },
  { label: 'WEBP', extension: 'webp', mimeTypes: ['image/webp'], sharpFormats: ['webp'] },
];

export const ACCEPTED_MIME_TYPES = INPUT_IMAGE_FORMATS.flatMap((format) => format.mimeTypes);

export const ACCEPTED_FORMAT_LABELS = INPUT_IMAGE_FORMATS.map((format) => format.label);

export function isAcceptedMimeType(mimeType: string): boolean {
  return ACCEPTED_MIME_TYPES.includes(mimeType.toLowerCase());
}

/** "image/jpeg" → "jpg". Retorna undefined para formatos não aceitos. */
export function extensionForMimeType(mimeType: string): string | undefined {
  const type = mimeType.toLowerCase();
  return INPUT_IMAGE_FORMATS.find((format) => format.mimeTypes.includes(type))?.extension;
}

export function isAcceptedSharpFormat(format: string | undefined): boolean {
  return !!format && INPUT_IMAGE_FORMATS.some((f) => f.sharpFormats.includes(format));
}

const formatList = new Intl.ListFormat('pt-BR', { type: 'disjunction' }).format(ACCEPTED_FORMAT_LABELS);

/** Ex.: "Formato de arquivo não permitido. Envie JPG, PNG ou WEBP." */
export const UNSUPPORTED_FORMAT_MESSAGE = `Formato de arquivo não permitido. Envie ${formatList}.`;
