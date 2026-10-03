import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/release/**', '**/desktop-dist/**', '**/outputs/**'],
    },
  },
  base: './',
  build: {
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom', 'zod'] } },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
