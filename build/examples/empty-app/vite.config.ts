import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    outDir: 'src/js',
    emptyOutDir: false,
    lib: { entry: fileURLToPath(new URL('frontend/main.ts', import.meta.url)), formats: ['iife'], name: 'HcExampleAppBundle', fileName: () => 'main.js' },
  },
})
