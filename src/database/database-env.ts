export interface DatabaseEnv {
  url: string;
  ssl: boolean;
}

/**
 * Lê só o necessário para conectar no banco. Usado pelo CLI do TypeORM e
 * pelos scripts de seed, que rodam fora do container de DI do Nest.
 */
export function readDatabaseEnv(env: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }
  return { url, ssl: env.DATABASE_SSL === 'true' || env.DATABASE_SSL === '1' };
}

/** Carrega o .env da raiz do projeto, se existir (em produção as variáveis vêm do host). */
export function loadLocalEnvFile(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // Arquivo ausente: segue com as variáveis já definidas no ambiente.
  }
}
