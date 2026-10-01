export interface UploadFileInput {
  /** Chave do arquivo no bucket, ex.: works/{uuid}.webp */
  path: string;
  body: Buffer;
  contentType: string;
}

export interface StoredFile {
  path: string;
  publicUrl: string;
}

/** Permissão temporária para o navegador enviar um arquivo direto ao Storage. */
export interface SignedUpload {
  /** Caminho do original na área temporária, ex.: staging/{uuid}.jpg */
  path: string;
  /** URL para o navegador fazer PUT do arquivo (o token já vai na URL). */
  uploadUrl: string;
  /** Validade da URL, em segundos. */
  expiresInSeconds: number;
}

export interface StagedFile {
  path: string;
  createdAt: Date;
}

/**
 * Contrato de armazenamento de arquivos. A aplicação depende apenas dele;
 * trocar Supabase por Cloudflare R2 ou AWS S3 é escrever outra implementação
 * (todos oferecem URLs assinadas para upload direto).
 */
export interface StorageProvider {
  // ---- Arquivos publicados (bucket público) ----
  upload(input: UploadFileInput): Promise<StoredFile>;
  /** Idempotente: remover um arquivo que já não existe não é erro. */
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): string;

  // ---- Área temporária (bucket privado) para upload direto do navegador ----
  createStagingUpload(path: string): Promise<SignedUpload>;
  /** Retorna null se o arquivo não existir (não enviado ou já removido). */
  downloadStaged(path: string): Promise<Buffer | null>;
  deleteStaged(paths: string[]): Promise<void>;
  listStaged(): Promise<StagedFile[]>;
}
