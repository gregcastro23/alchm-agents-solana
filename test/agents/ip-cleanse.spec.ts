/** @vitest-environment node */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Pentacle Vessel Rating system speaks Alchm / Pentacles vocabulary only: Alchemical
 * Seals (Copper, Silver, Gold, Aether, Celestial) and Resonance Surge. No third-party sports
 * terminology may live in the rating modules, their API route, or the agent specs.
 *
 * The words are assembled from fragments so this file does not contain them itself.
 */
const BANNED = [
  ['n', 'ba'],
  ['2', 'k'],
  ['hall of ', 'fame'],
  ['bron', 'ze'],
  ['take', 'over'],
].map(parts => parts.join(''))
const PATTERN = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i')

const ROOT = join(__dirname, '..', '..')
const SCANNED = ['lib/agents/rating', 'app/api/agents/rating', 'test/agents']
const EXTENSIONS = /\.(ts|tsx|js|jsx|json|md)$/

function walk(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  return entries.flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : EXTENSIONS.test(name) ? [path] : []
  })
}

describe('rating vocabulary', () => {
  const files = SCANNED.flatMap(dir => walk(join(ROOT, dir)))

  it('scans the rating modules, the route and the agent specs', () => {
    const relative_ = files.map(f => relative(ROOT, f))
    expect(relative_).toContain('lib/agents/rating/seals-surge.ts')
    expect(relative_).toContain('lib/agents/rating/ovr-archetype.ts')
    expect(relative_).toContain('test/agents/seals-surge.spec.ts')
    expect(files.length).toBeGreaterThan(5)
  })

  it('contains no third-party sports terminology', () => {
    const hits: string[] = []
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (PATTERN.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        })
      if (PATTERN.test(relative(ROOT, file))) hits.push(`${relative(ROOT, file)} (file name)`)
    }
    expect(hits).toEqual([])
  })

  it('catches the words it is meant to catch', () => {
    for (const word of BANNED) {
      expect(PATTERN.test(`the ${word.toUpperCase()} tier`)).toBe(true)
      expect(PATTERN.test(`${word}s`)).toBe(false) // whole words only
    }
  })
})
