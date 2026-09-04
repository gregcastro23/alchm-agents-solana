import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 180_000,
    include: ['test/solana/esms-persona.spec.ts', 'test/solana/devnet-amm.spec.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(dirname, '.') },
  },
})
