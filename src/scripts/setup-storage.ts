/**
 * Cria ou ajusta os buckets do Supabase Storage usados pela API.
 *
 *   npm run storage:setup
 *
 * - SUPABASE_STORAGE_BUCKET (padrão "works"): público, só WebP. Se já existir,
 *   apenas confere se está público (não altera nada).
 * - SUPABASE_UPLOADS_BUCKET (padrão "uploads"): privado, recebe os originais
 *   enviados pelo navegador. É criado ou atualizado com o limite MAX_FILE_SIZE_MB.
 *
 * Idempotente: pode rodar quantas vezes quiser.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadLocalEnvFile } from '../database/database-env.js';
import { ACCEPTED_MIME_TYPES } from '../images/image-formats.js';

interface BucketSettings {
  public: boolean;
  fileSizeLimit: string;
  allowedMimeTypes: string[];
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function ensureBucket(
  client: SupabaseClient,
  name: string,
  settings: BucketSettings,
  updateExisting: boolean,
): Promise<void> {
  const existing = await client.storage.getBucket(name);

  if (existing.error) {
    const created = await client.storage.createBucket(name, settings);
    if (created.error) fail(`Não foi possível criar o bucket "${name}": ${created.error.message}`);
    console.log(`✔ Bucket "${name}" criado (${settings.public ? 'público' : 'privado'}).`);
    return;
  }

  if (!updateExisting) {
    if (existing.data.public !== settings.public) {
      console.warn(
        `⚠ Bucket "${name}" existe, mas deveria ser ${settings.public ? 'público' : 'privado'}. Ajuste no painel.`,
      );
    } else {
      console.log(`✔ Bucket "${name}" já existe e está ${settings.public ? 'público' : 'privado'}.`);
    }
    return;
  }

  const updated = await client.storage.updateBucket(name, settings);
  if (updated.error) fail(`Não foi possível atualizar o bucket "${name}": ${updated.error.message}`);
  console.log(`✔ Bucket "${name}" atualizado (${settings.public ? 'público' : 'privado'}).`);
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.');

  const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 25);
  const publicBucket = process.env.SUPABASE_STORAGE_BUCKET || 'works';
  const uploadsBucket = process.env.SUPABASE_UPLOADS_BUCKET || 'uploads';
  const client = createClient(url, key, { auth: { persistSession: false } });

  await ensureBucket(
    client,
    publicBucket,
    { public: true, fileSizeLimit: `${maxMb}MB`, allowedMimeTypes: ['image/webp'] },
    false,
  );
  await ensureBucket(
    client,
    uploadsBucket,
    { public: false, fileSizeLimit: `${maxMb}MB`, allowedMimeTypes: ACCEPTED_MIME_TYPES },
    true,
  );
}

main().catch((error: Error) => fail(error.message));
