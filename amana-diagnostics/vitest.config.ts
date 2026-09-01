import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    pool: 'forks',
    // Build output contains stale copies of source tests — never collect from it
    exclude: ['**/node_modules/**', '**/.next/**', '**/.open-next/**', '**/dist/**', '**/src-tauri/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
