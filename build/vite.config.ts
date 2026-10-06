import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    emptyOutDir: true,
    lib: {
      entry: 'frontend/index.ts',
      name: 'HcSharedAppCoreBundle',
      formats: ['iife'],
      fileName: () => 'hc_shared_app_core.js',
    },
    outDir: '../src/js',
    sourcemap: false,
  },
})
