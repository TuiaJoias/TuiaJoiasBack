import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // O Nest carrega reflect-metadata no boot; testes isolados precisam dele também.
    setupFiles: ['reflect-metadata'],
  },
});
