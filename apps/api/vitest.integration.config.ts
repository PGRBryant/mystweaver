import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
