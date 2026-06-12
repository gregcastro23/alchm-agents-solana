import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shellRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: shellRoot,
  base: './',
  publicDir: resolve(shellRoot, '../public'),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
