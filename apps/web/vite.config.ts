import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@blackbox-protocol/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@blackbox-protocol/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
    },
  },
});
