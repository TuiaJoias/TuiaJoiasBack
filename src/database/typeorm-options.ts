import type { DataSourceOptions } from 'typeorm';
import { Category } from '../categories/entities/category.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Work } from '../works/entities/work.entity.js';
import type { DatabaseEnv } from './database-env.js';
import { migrations } from './migrations/index.js';

export const entities = [User, Category, Work];

/** Opções compartilhadas entre a aplicação, o CLI de migrations e os seeds. */
export function buildDataSourceOptions(db: DatabaseEnv): DataSourceOptions {
  return {
    type: 'postgres',
    url: db.url,
    // Bancos gerenciados exigem TLS. A conexão é criptografada; a validação da
    // cadeia de certificados é desativada porque provedores como o Supabase
    // usam CA própria (veja docs/DEPLOY.md).
    ssl: db.ssl ? { rejectUnauthorized: false } : false,
    entities,
    migrations,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
  };
}
