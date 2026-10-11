import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@blackbox-protocol/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@blackbox-protocol/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
    },
  },
});
