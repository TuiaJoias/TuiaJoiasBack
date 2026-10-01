import { DataSource } from 'typeorm';
import { readDatabaseEnv } from '../../src/database/database-env.js';
import { seedCategories } from '../../src/database/seeds/seed-categories.js';
import { buildDataSourceOptions } from '../../src/database/typeorm-options.js';

/** Recria o schema do banco de teste do zero, roda as migrations e o seed. */
export default async function setup(): Promise<void> {
  process.loadEnvFile('.env.test');
  const db = readDatabaseEnv();
  if (!db.url.includes('_test')) {
    throw new Error(`Recusando limpar um banco que não é de teste: ${db.url}`);
  }

  const dataSource = new DataSource(buildDataSourceOptions(db));
  await dataSource.initialize();
  try {
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.runMigrations();
    await seedCategories(dataSource);
  } finally {
    await dataSource.destroy();
  }
}
