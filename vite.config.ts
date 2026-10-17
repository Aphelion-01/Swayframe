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
      input: {
        app: 'index.html',
        agentCoreV2: 'src/agent-v2/index.ts',
        editorOperations: 'src/desktop/editor-operations.ts',
      },
      preserveEntrySignatures: 'strict',
      output: { manualChunks: { vendor: ['react', 'react-dom', 'zod'] } },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
