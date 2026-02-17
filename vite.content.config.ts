import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'content/screenshot.ts'),
      formats: ['iife'],
      name: 'DesignLogContent',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
    outDir: 'dist',
  },
});
