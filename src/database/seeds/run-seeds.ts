import { seedCategories } from './seed-categories.js';
import { fail, withDataSource } from './seed-runner.js';

try {
  const created = await withDataSource(seedCategories);
  console.log(
    created > 0
      ? `✔ ${created} categoria(s) criada(s).`
      : '✔ Categorias iniciais já existiam. Nada a fazer.',
  );
} catch (error) {
  fail(`Falha ao executar seed: ${(error as Error).message}`);
}
