import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['typescript/**/*.test.ts'],
    globals: true,
  },
});
