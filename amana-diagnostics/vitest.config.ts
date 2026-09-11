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
    /*
     * Vitest defaults to 5 seconds, which the screen tests fail on a busy
     * machine — not because anything is slow to settle, but because the first
     * test in a file pays for mounting the whole component library into jsdom:
     * Radix, the icon set and the token layer. StaffScreen, DepartmentPage and
     * WalletTab all timed out when a production build was running alongside
     * them, and passed on their own.
     *
     * A test that depends on machine load is worse than no test, so the budget
     * is the real one. Anything that actually hangs still fails, just later.
     */
    testTimeout: 20000,
    hookTimeout: 20000,
    // Build output contains stale copies of source tests — never collect from it
    exclude: ['**/node_modules/**', '**/.next/**', '**/.open-next/**', '**/dist/**', '**/src-tauri/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
