import { INPUT_IMAGE_FORMATS } from '../../images/image-formats.js';
import { STAGING_FOLDER } from '../../storage/storage.constants.js';

const extensions = INPUT_IMAGE_FORMATS.map((format) => format.extension).join('|');

/**
 * Formato exato dos caminhos gerados pela API (staging/{uuid}.{ext}). Recusar
 * qualquer outro impede que um cliente aponte para arquivos fora da área temporária.
 */
export const STAGING_PATH_PATTERN = new RegExp(
  `^${STAGING_FOLDER}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${extensions})$`,
);

export const INVALID_UPLOAD_MESSAGE = 'Envio de imagem inválido. Envie a foto novamente.';
