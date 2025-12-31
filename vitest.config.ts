import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        '*.config.*',
        'scripts',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
