#!/usr/bin/env bun
/**
 * Codebase health manifest generator.
 *
 * The operator console needs to show where the codebase is weak and what work
 * is unfinished. It cannot scan for that at request time in production: Vercel
 * ships a compiled bundle, not the repo, so `fs` reads of `lib/**` return
 * nothing there. Scanning at request time in dev and showing an empty panel in
 * prod would be worse than useless — the panel would claim the codebase is
 * clean precisely where it matters most.
 *
 * So the scan runs here, at build time, and writes a manifest that is imported
 * statically and therefore travels with the deployment. The manifest carries
 * its own `generatedAt` and the commit it was taken from, so the console can
 * say how old the picture is rather than implying it is live.
 *
 * Usage:
 *   bun run scripts/generate-codebase-health.ts
 *   bun run generate:codebase-health          (package.json alias)
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { CodebaseHealthManifest } from '../lib/admin/codebase-health-types'

const REPO_ROOT = join(import.meta.dir, '..')
const OUTPUT = join(REPO_ROOT, 'lib', 'admin', 'codebase-health-manifest.json')

/** Trees worth scanning — the application surface, not vendored code. */
const SOURCE_ROOTS = [
  'app',
  'lib',
  'components',
  'hooks',
  'backend',
  'scripts',
  'test',
  'desktop-shell',
  'pa-rust-backend/src',
]

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  'target',
  '__pycache__',
  'generated',
  '.turbo',
  'test-results',
])

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.mjs', '.cjs'])

type Marker = {
  kind: 'todo' | 'fixme' | 'hack' | 'xxx' | 'not-implemented' | 'ts-expect' | 'skipped-test'
  file: string
  line: number
  text: string
}

/**
 * Each pattern is anchored to a comment or call form rather than the bare word,
 * so prose that merely mentions "TODO" in a docstring is not counted as debt.
 */
const MARKER_PATTERNS: Array<{ kind: Marker['kind']; re: RegExp }> = [
  { kind: 'todo', re: /(?:\/\/|#|\/\*|\*)\s*TODO\b[:\s]?(.*)/ },
  { kind: 'fixme', re: /(?:\/\/|#|\/\*|\*)\s*FIXME\b[:\s]?(.*)/ },
  { kind: 'hack', re: /(?:\/\/|#|\/\*|\*)\s*HACK\b[:\s]?(.*)/ },
  { kind: 'xxx', re: /(?:\/\/|#|\/\*|\*)\s*XXX\b[:\s]?(.*)/ },
  {
    kind: 'not-implemented',
    re: /\b(?:NotImplementedError|not\s+implemented\s+yet|throw new Error\(['"]Not implemented)/i,
  },
  { kind: 'ts-expect', re: /@ts-(?:ignore|expect-error|nocheck)\b(.*)/ },
  { kind: 'skipped-test', re: /\b(?:it|test|describe)\.(?:skip|todo)\s*\(/ },
]

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue
    const full = join(dir, entry)
    let stats
    try {
      stats = statSync(full)
    } catch {
      continue
    }
    if (stats.isDirectory()) {
      walk(full, out)
    } else if (SCANNED_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full)
    }
  }
  return out
}

function scanFile(path: string): { markers: Marker[]; lines: number } {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return { markers: [], lines: 0 }
  }

  const rel = relative(REPO_ROOT, path)
  const lines = content.split('\n')
  const markers: Marker[] = []

  lines.forEach((line, index) => {
    // A single line can only be one kind of marker; first match wins so a
    // `// TODO: @ts-ignore this` is not double-counted.
    for (const { kind, re } of MARKER_PATTERNS) {
      const match = line.match(re)
      if (match) {
        markers.push({
          kind,
          file: rel,
          line: index + 1,
          text: line.trim().slice(0, 200),
        })
        break
      }
    }
  })

  return { markers, lines: lines.length }
}

function tryExec(command: string): string | null {
  try {
    return execSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Natal-chart provenance census.
 *
 * `HistoricalCraftedAgent` makes provenance a compile-time requirement, so
 * every agent file declares one of computed | authored | placeholder |
 * unattributed. A `placeholder` chart is a chart nobody has actually derived —
 * it is the single largest correctness debt in the agent roster, and the
 * provenance spec ratchets the count downward, so the console needs the number.
 */
function censusNatalProvenance() {
  const dir = join(REPO_ROOT, 'lib', 'agents', 'historical')
  const counts: Record<string, number> = {}
  const placeholders: string[] = []

  let entries: string[]
  try {
    entries = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts')
  } catch {
    return { counts, placeholders, total: 0, available: false }
  }

  for (const entry of entries) {
    let content: string
    try {
      content = readFileSync(join(dir, entry), 'utf8')
    } catch {
      continue
    }
    const match = content.match(/provenance:\s*'([a-z]+)'/)
    if (!match) continue
    const provenance = match[1]
    counts[provenance] = (counts[provenance] ?? 0) + 1
    if (provenance === 'placeholder' || provenance === 'unattributed') {
      placeholders.push(entry.replace(/\.ts$/, ''))
    }
  }

  return {
    counts,
    placeholders: placeholders.sort(),
    total: entries.length,
    available: true,
  }
}

/**
 * Type-safety escape hatches. `next.config.mjs` sets
 * `typescript.ignoreBuildErrors: true`, so the build cannot be trusted to
 * police types — the density of `any` and non-null assertions is the closest
 * standing proxy the console can show without running tsc on every request.
 */
function censusTypeEscapes(files: string[]) {
  const ANY_RE = /:\s*any\b|<any>|as\s+any\b/g
  const NON_NULL_RE = /\w!\./g

  let anyCount = 0
  let nonNullCount = 0
  const perFile = new Map<string, number>()

  for (const file of files) {
    if (!/\.tsx?$/.test(file)) continue
    let content: string
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const anys = content.match(ANY_RE)?.length ?? 0
    const nonNulls = content.match(NON_NULL_RE)?.length ?? 0
    anyCount += anys
    nonNullCount += nonNulls
    if (anys > 0) perFile.set(relative(REPO_ROOT, file), anys)
  }

  return {
    any: anyCount,
    nonNullAssertions: nonNullCount,
    worstFiles: [...perFile.entries()]
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
  }
}

/**
 * API routes with no test file naming them. A route with no test is not
 * necessarily broken, but it is where a regression lands unnoticed, so it is
 * exactly the "weak point" the console is meant to surface.
 */
function censusUntestedRoutes(files: string[]) {
  const routes = files
    .map(f => relative(REPO_ROOT, f))
    .filter(f => f.startsWith('app/api/') && /route\.tsx?$/.test(f))

  // One pass over the test tree; membership is a substring check on the route's
  // URL path, which is how these tests actually reference their subject.
  const testFiles = files.filter(f => /(^|\/)(test|__tests__)\//.test(relative(REPO_ROOT, f)))
  let testCorpus = ''
  for (const file of testFiles) {
    try {
      testCorpus += readFileSync(file, 'utf8')
    } catch {
      // skip unreadable test file
    }
  }

  const untested = routes.filter(route => {
    const urlPath = `/${route.replace(/^app\//, '').replace(/\/route\.tsx?$/, '')}`
    return !testCorpus.includes(urlPath)
  })

  return {
    totalRoutes: routes.length,
    untestedCount: untested.length,
    coveragePct:
      routes.length > 0
        ? Math.round(((routes.length - untested.length) / routes.length) * 1000) / 10
        : 0,
    untested: untested.sort().slice(0, 60),
    untestedTruncated: Math.max(0, untested.length - 60),
  }
}

/**
 * Repo invariant gates, run for real. These are cheap and their result is the
 * whole point — a gate reported as "configured" rather than "passing" tells the
 * operator nothing.
 */
function runGates() {
  const gates = [
    {
      id: 'no-stray-kalchm',
      label: 'Kalchm/Monica single-definition gate',
      command: 'bun run check:no-stray-kalchm',
    },
    {
      id: 'no-fabricated-monica',
      label: 'No fabricated Monica fallback',
      command: 'bun run check:no-fabricated-monica',
    },
  ]

  return gates.map(gate => {
    const started = Date.now()
    try {
      execSync(gate.command, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      })
      return {
        ...gate,
        passing: true,
        durationMs: Date.now() - started,
        output: null as string | null,
      }
    } catch (error) {
      const output =
        error && typeof error === 'object' && 'stdout' in error
          ? String((error as { stdout?: unknown }).stdout ?? '').slice(-1500)
          : String(error).slice(-1500)
      return { ...gate, passing: false, durationMs: Date.now() - started, output }
    }
  })
}

/**
 * Full `tsc --noEmit` census. Opt-in (`--with-typecheck`) because it takes
 * minutes; when skipped the manifest says so explicitly rather than reporting
 * zero errors.
 */
function censusTypeErrors(enabled: boolean) {
  if (!enabled) {
    return { ran: false, total: 0, byFile: [] as Array<{ file: string; count: number }> }
  }

  let output = ''
  try {
    execSync("NODE_OPTIONS='--max-old-space-size=4096' bunx tsc --noEmit", {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 900_000,
    })
  } catch (error) {
    output =
      error && typeof error === 'object' && 'stdout' in error
        ? String((error as { stdout?: unknown }).stdout ?? '')
        : ''
  }

  const perFile = new Map<string, number>()
  let total = 0
  for (const line of output.split('\n')) {
    const match = line.match(/^(.+?)\(\d+,\d+\):\s+error TS\d+/)
    if (!match) continue
    total += 1
    perFile.set(match[1], (perFile.get(match[1]) ?? 0) + 1)
  }

  return {
    ran: true,
    total,
    byFile: [...perFile.entries()]
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30),
  }
}

function main() {
  const started = Date.now()
  const files: string[] = []
  for (const root of SOURCE_ROOTS) {
    walk(join(REPO_ROOT, root), files)
  }

  const allMarkers: Marker[] = []
  let totalLines = 0
  const perFileMarkers = new Map<string, number>()

  for (const file of files) {
    const { markers, lines } = scanFile(file)
    totalLines += lines
    if (markers.length > 0) {
      allMarkers.push(...markers)
      perFileMarkers.set(relative(REPO_ROOT, file), markers.length)
    }
  }

  const byKind: Record<string, number> = {}
  for (const marker of allMarkers) byKind[marker.kind] = (byKind[marker.kind] ?? 0) + 1

  // Which area of the app carries the debt — the first path segment.
  const byArea: Record<string, number> = {}
  for (const marker of allMarkers) {
    const area = marker.file.split('/')[0]
    byArea[area] = (byArea[area] ?? 0) + 1
  }

  const hotspots = [...perFileMarkers.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  const withTypecheck = process.argv.includes('--with-typecheck')
  const withGates = !process.argv.includes('--skip-gates')

  const natalProvenance = censusNatalProvenance()
  const typeEscapes = censusTypeEscapes(files)
  const routeCoverage = censusUntestedRoutes(files)
  const gates = withGates ? runGates() : []
  const typeErrors = censusTypeErrors(withTypecheck)

  // Annotated, so the producer cannot drift from what the route and panel read.
  const manifest: CodebaseHealthManifest = {
    generatedAt: new Date().toISOString(),
    commit: tryExec('git rev-parse --short HEAD'),
    branch: tryExec('git rev-parse --abbrev-ref HEAD'),
    scanDurationMs: Date.now() - started,
    scannedRoots: SOURCE_ROOTS,
    totals: {
      files: files.length,
      lines: totalLines,
      markers: allMarkers.length,
      /** Markers per thousand lines — comparable across a growing codebase. */
      markerDensityPerKLoc:
        totalLines > 0 ? Math.round((allMarkers.length / totalLines) * 1000 * 100) / 100 : 0,
    },
    byKind,
    byArea: Object.entries(byArea)
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count),
    hotspots,
    /**
     * Every marker, capped. The cap is stated rather than silent — a truncated
     * list that looks complete is the failure mode being avoided.
     */
    markerCap: 500,
    markers: allMarkers.slice(0, 500),
    truncated: Math.max(0, allMarkers.length - 500),
    natalProvenance,
    typeEscapes,
    routeCoverage,
    gates,
    typeErrors,
    /** Which optional passes ran, so the console never reads a skip as a pass. */
    passes: {
      typecheck: withTypecheck,
      gates: withGates,
    },
  }

  writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `[codebase-health] scanned ${files.length} files / ${totalLines.toLocaleString()} lines`
  )
  console.log(`[codebase-health] ${allMarkers.length} markers →`, byKind)
  console.log(
    `[codebase-health] natal charts: ${natalProvenance.placeholders.length} placeholder of ${natalProvenance.total}`
  )
  console.log(
    `[codebase-health] routes: ${routeCoverage.untestedCount}/${routeCoverage.totalRoutes} untested (${routeCoverage.coveragePct}% covered)`
  )
  console.log(
    `[codebase-health] any: ${typeEscapes.any} · non-null assertions: ${typeEscapes.nonNullAssertions}`
  )
  for (const gate of gates) {
    console.log(`[codebase-health] gate ${gate.id}: ${gate.passing ? 'PASS' : 'FAIL'}`)
  }
  if (withTypecheck) {
    console.log(`[codebase-health] tsc --noEmit: ${typeErrors.total} errors`)
  } else {
    console.log('[codebase-health] tsc census skipped (pass --with-typecheck to include it)')
  }
  if (manifest.truncated > 0) {
    console.log(
      `[codebase-health] ${manifest.truncated} markers beyond the ${manifest.markerCap} cap were not written`
    )
  }
  console.log(`[codebase-health] wrote ${relative(REPO_ROOT, OUTPUT)}`)
}

main()
