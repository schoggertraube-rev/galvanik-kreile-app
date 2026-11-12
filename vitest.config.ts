import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // PL 12.11.16:51: bound local full-suite workers to protect the shared PC.
    maxWorkers: 4,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Vitest-only stub: production keeps the real server-only boundary marker.
      'server-only': path.resolve(__dirname, './src/test/serverOnlyMock.ts'),
    },
  },
});
