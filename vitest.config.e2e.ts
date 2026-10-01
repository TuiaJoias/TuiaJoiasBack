import { defineConfig } from 'vitest/config';

/**
 * Testes ponta a ponta contra o banco tuia_joias_test (veja .env.test).
 * Os arquivos rodam em sequência porque compartilham o mesmo banco.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    setupFiles: ['./test/support/load-test-env.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
