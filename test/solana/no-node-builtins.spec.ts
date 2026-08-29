/**
 * Guards the Solana client surface against Node built-ins.
 *
 * webpack cannot bundle a `node:` scheme import for the browser. A single one
 * anywhere in a client component's transitive import graph fails the **production
 * build** with
 *
 *   Module build failed: UnhandledSchemeError: Reading from "node:os" is not
 *   handled by plugins
 *
 * and `next.config.mjs`'s `resolve.fallback` does not help: it maps bare `fs`/`os`/
 * `path`, not the `node:` scheme, and lists no `crypto` at all.
 *
 * This has now happened twice. `useSolanaShop` (a `'use client'` hook) imported one
 * pure helper from `solana-minter.ts` and dragged in `node:fs`/`node:os`/`node:path`,
 * breaking every Vercel deploy; and `constellation-amm.ts` shipped with
 * `node:crypto` for its Anchor discriminators while being the module whose whole
 * job is building transactions a wallet signs. Neither was caught by `tsc`, ESLint,
 * or any unit test — only by a full `next build`, which CI runs late and locally
 * nobody runs at all.
 *
 * So it is asserted here instead, in a test that runs in about a millisecond.
 */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

/**
 * Modules that must stay importable from a `'use client'` component. Anything a
 * browser needs in order to derive an address, quote a swap, build a preimage, or
 * assemble a transaction belongs here.
 */
const CLIENT_SAFE_ENTRY_POINTS = [
  'lib/solana/constellation-amm.ts',
  'lib/solana/vectors.ts',
  'lib/solana/esms.ts',
  'lib/solana/priority-fee.ts',
  'lib/solana/star-vault.ts',
  'lib/solana/useSolanaShop.ts',
]

/**
 * Modules that are server-only *by design* and must keep their Node built-ins —
 * the import is what makes them fail loudly if they are ever pulled into a client
 * bundle, rather than silently shipping a keypair loader to the browser.
 */
const SERVER_ONLY = ['lib/solana/amm-attestor.ts', 'lib/solana/solana-minter.ts']

// `[\s\S]*?` rather than `[^'"\n]*?`: a multi-line `import { a, b } from '...'`
// is the common form here, and a newline-free pattern silently skips every one of
// them -- which made an earlier draft of this file walk 4 modules instead of 20 and
// assert almost nothing. `actually resolves the graph it claims to walk` is what
// catches that.
const IMPORT_SPECIFIER = /(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/** Resolves a local import specifier to a file on disk, or null if it is a package. */
function resolveLocal(specifier: string, importer: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2))
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(importer), specifier)
  else return null

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (candidate.endsWith('.ts') || candidate.endsWith('.tsx')) {
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

interface Graph {
  modules: Set<string>
  /** `node:` specifier -> the files that import it. */
  builtins: Map<string, Set<string>>
}

/** Walks the transitive graph of *local* imports, collecting `node:` specifiers. */
function walkImports(entry: string): Graph {
  const modules = new Set<string>()
  const builtins = new Map<string, Set<string>>()
  const queue = [path.join(ROOT, entry)]

  while (queue.length > 0) {
    const file = queue.pop()!
    if (modules.has(file)) continue
    modules.add(file)

    const source = readFileSync(file, 'utf8')
    for (const pattern of [IMPORT_SPECIFIER, BARE_IMPORT, DYNAMIC_IMPORT]) {
      pattern.lastIndex = 0
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1]
        if (specifier.startsWith('node:')) {
          const importers = builtins.get(specifier) ?? new Set<string>()
          importers.add(path.relative(ROOT, file))
          builtins.set(specifier, importers)
          continue
        }
        const resolved = resolveLocal(specifier, file)
        if (resolved) queue.push(resolved)
      }
    }
  }
  return { modules, builtins }
}

describe('Solana client surface', () => {
  it.each(CLIENT_SAFE_ENTRY_POINTS)('%s imports no Node built-in, transitively', entry => {
    const { builtins } = walkImports(entry)
    const offenders = [...builtins.entries()].map(
      ([specifier, importers]) => `${specifier} (via ${[...importers].join(', ')})`
    )
    expect(
      offenders,
      `${entry} reaches a Node built-in, which fails the production build with ` +
        'UnhandledSchemeError. Move the server-only code behind its own module, or ' +
        'swap the built-in for a browser-safe equivalent (@noble/hashes for sha256).'
    ).toEqual([])
  })

  it.each(SERVER_ONLY)('%s stays server-only and keeps its Node built-ins', entry => {
    const { builtins } = walkImports(entry)
    expect(
      builtins.size,
      `${entry} is server-only by design; its Node built-ins are what make it fail ` +
        'loudly rather than silently ship to the browser. If it no longer needs ' +
        'them, move it to CLIENT_SAFE_ENTRY_POINTS instead of deleting this case.'
    ).toBeGreaterThan(0)
  })

  it('never lets a client-safe entry point reach a server-only module', () => {
    const serverOnly = SERVER_ONLY.map(entry => path.join(ROOT, entry))
    for (const entry of CLIENT_SAFE_ENTRY_POINTS) {
      const { modules } = walkImports(entry)
      for (const forbidden of serverOnly) {
        expect(modules.has(forbidden), `${entry} reaches ${path.relative(ROOT, forbidden)}`).toBe(
          false
        )
      }
    }
  })

  it('actually resolves the graph it claims to walk', () => {
    // A resolver that silently returns null for everything would make every
    // assertion above vacuous.
    const { modules } = walkImports('lib/solana/constellation-amm.ts')
    for (const reached of [
      'lib/solana/vectors.ts',
      'lib/solana/esms.ts',
      'lib/solana/priority-fee.ts',
    ]) {
      expect(
        [...modules].some(file => file.endsWith(reached)),
        `did not reach ${reached}`
      ).toBe(true)
    }
    // useSolanaShop is the deep one -- it is the graph that actually broke before.
    expect(walkImports('lib/solana/useSolanaShop.ts').modules.size).toBeGreaterThan(10)
  })
})
