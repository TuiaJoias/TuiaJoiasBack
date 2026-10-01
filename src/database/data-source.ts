import { DataSource } from 'typeorm';
import { loadLocalEnvFile, readDatabaseEnv } from './database-env.js';
import { buildDataSourceOptions } from './typeorm-options.js';

// Usado somente pelo CLI do TypeORM (npm run migration:*), sobre o build em dist/.
loadLocalEnvFile();

export default new DataSource(buildDataSourceOptions(readDatabaseEnv()));
