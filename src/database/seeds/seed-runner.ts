import { DataSource } from 'typeorm';
import { loadLocalEnvFile, readDatabaseEnv } from '../database-env.js';
import { buildDataSourceOptions } from '../typeorm-options.js';

/** Abre uma conexão própria para scripts de linha de comando e garante o fechamento. */
export async function withDataSource<T>(task: (dataSource: DataSource) => Promise<T>): Promise<T> {
  loadLocalEnvFile();
  const dataSource = new DataSource(buildDataSourceOptions(readDatabaseEnv()));
  await dataSource.initialize();
  try {
    return await task(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

export function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
