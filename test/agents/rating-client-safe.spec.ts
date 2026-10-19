/** @vitest-environment node */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { builtinModules } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve as resolvePath } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Client safety of the Pentacle Vessel Rating modules.
 *
 * `lib/agents/rating/*` is imported by client modules (and `pentacles` bundles it), so nothing
 * it reaches may be a database, Prisma, Redis, `server-only` or a Node built-in. A reviewer
 * reproduced the failure: a `typeof window`-guarded `import('@/lib/db')` is folded away in the
 * browser layer, but Next compiles every client component a second time in the SSR layer, where
 * the guard stays and the import is followed. `lib/db.ts` is `server-only`, so `next build`
 * dies with a boundary error that no unit test, `tsc` or lint run notices.
 *
 * This spec therefore walks the import graph itself, the way the bundler does:
 *   - it follows static imports, side-effect imports, `export ... from`, `import x = require()`,
 *     `require()` AND dynamic `import()`;
 *   - it ignores only type-only edges (`import type`, `export type ... from`, and clauses whose
 *     every specifier is inline `type`), which the compiler erases;
 *   - it treats `node_modules` packages as leaves and checks the leaf name against a deny-list.
 * A walker that is blind would let the guard pass for the wrong reason, so the walker is proven
 * against in-memory and on-disk fixtures, and the real walk must be non-trivial.
 */

const ROOT = join(__dirname, '..', '..')

// ─── The policy ──────────────────────────────────────────────────────────────

/** Files (relative to the project root) a client-reachable module must never reach. */
const FORBIDDEN_FILES = ['lib/db.ts']
/** `node_modules` packages a client-reachable module must never reach. */
const FORBIDDEN_PACKAGES = ['server-only', 'pg', 'ioredis']
/** Scopes whose every package is forbidden. */
const FORBIDDEN_SCOPES = ['@prisma/']
/** A `*.server.*` module is, by naming convention, server-only. */
const SERVER_MODULE = /\.server\.[cm]?[jt]sx?$/

/**
 * Node's built-ins, matched by exact specifier (a `node:` prefix is always a built-in).
 * `builtinModules` is the runtime's own list; the literal names pin the core set so a runtime
 * whose list is shorter cannot weaken the guard. A bare `process/browser` or `buffer/` names an
 * npm package, not a built-in, and is deliberately not matched.
 */
const NODE_BUILTINS = new Set<string>([
  ...builtinModules.map(name => name.replace(/^node:/, '')),
  ...[
    'assert',
    'async_hooks',
    'buffer',
    'child_process',
    'cluster',
    'crypto',
    'dgram',
    'dns',
    'events',
    'fs',
    'http',
    'http2',
    'https',
    'inspector',
    'module',
    'net',
    'os',
    'path',
    'perf_hooks',
    'process',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'timers',
    'tls',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'worker_threads',
    'zlib',
    'assert/strict',
    'dns/promises',
    'fs/promises',
    'path/posix',
    'path/win32',
    'readline/promises',
    'stream/consumers',
    'stream/promises',
    'stream/web',
    'timers/promises',
    'util/types',
  ],
])

// ─── Reading imports out of a module ─────────────────────────────────────────

type EdgeKind = 'import' | 'side-effect' | 're-export' | 'import-equals' | 'dynamic' | 'require'

interface ImportRef {
  specifier: string
  kind: EdgeKind
}

interface ComputedRef {
  kind: 'dynamic' | 'require'
  expression: string
}

interface ParsedModule {
  /** Edges a bundler follows. */
  runtime: ImportRef[]
  /** Edges the compiler erases. Kept so the walker's own tests can see what it skipped. */
  typeOnly: ImportRef[]
  /** `import(x)` / `require(x)` whose argument is not a string literal: the walker is blind here. */
  computed: ComputedRef[]
  /** The module carries a leading `'use client'` directive. */
  useClient: boolean
}

function scriptKindOf(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

/** `import type X`, or `import { type A, type B }` with no default binding. */
function isTypeOnlyImport(declaration: ts.ImportDeclaration): boolean {
  const clause = declaration.importClause
  if (!clause) return false // `import 'x'` runs the module
  if (clause.isTypeOnly) return true
  if (clause.name) return false // a default binding is a value
  const bindings = clause.namedBindings
  return (
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    // `import {} from 'x'` has no specifier to be type-only: treat it as a value import.
    bindings.elements.length > 0 &&
    bindings.elements.every(element => element.isTypeOnly)
  )
}

/** `export type { A } from`, `export type * from`, or `export { type A } from`. */
function isTypeOnlyExport(declaration: ts.ExportDeclaration): boolean {
  if (declaration.isTypeOnly) return true
  const clause = declaration.exportClause
  return (
    clause !== undefined &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0 &&
    clause.elements.every(element => element.isTypeOnly)
  )
}

function parseModule(fileName: string, text: string): ParsedModule {
  const file = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.ES2022,
    false,
    scriptKindOf(fileName)
  )
  const runtime: ImportRef[] = []
  const typeOnly: ImportRef[] = []
  const computed: ComputedRef[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const ref: ImportRef = {
        specifier: node.moduleSpecifier.text,
        kind: node.importClause ? 'import' : 'side-effect',
      }
      ;(isTypeOnlyImport(node) ? typeOnly : runtime).push(ref)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const ref: ImportRef = { specifier: node.moduleSpecifier.text, kind: 're-export' }
      ;(isTypeOnlyExport(node) ? typeOnly : runtime).push(ref)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      const ref: ImportRef = {
        specifier: node.moduleReference.expression.text,
        kind: 'import-equals',
      }
      ;(node.isTypeOnly ? typeOnly : runtime).push(ref)
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression
      const kind =
        callee.kind === ts.SyntaxKind.ImportKeyword
          ? 'dynamic'
          : ts.isIdentifier(callee) && callee.text === 'require'
            ? 'require'
            : null
      if (kind) {
        const argument = node.arguments[0]
        if (ts.isStringLiteralLike(argument)) {
          runtime.push({ specifier: argument.text, kind })
        } else {
          computed.push({ kind, expression: argument.getText(file) })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  let useClient = false
  for (const statement of file.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    if (statement.expression.text === 'use client') useClient = true
  }
  return { runtime, typeOnly, computed, useClient }
}

// ─── Resolving them, and walking the graph ───────────────────────────────────

interface SourceFs {
  read(path: string): string | null
  isFile(path: string): boolean
  /** Every `.ts/.tsx/.js/.jsx/.mjs/.cjs` file under `dir`, sorted. */
  listCode(dir: string): string[]
}

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git'])

const isCodeFile = (path: string): boolean =>
  CODE_EXTENSIONS.includes(extname(path)) && !path.endsWith('.d.ts')

const diskFs: SourceFs = {
  read(path) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  },
  isFile(path) {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  },
  listCode(dir) {
    const found: string[] = []
    const scan = (current: string): void => {
      let entries
      try {
        entries = readdirSync(current, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRECTORIES.has(entry.name)) scan(join(current, entry.name))
        } else if (isCodeFile(entry.name)) {
          found.push(join(current, entry.name))
        }
      }
    }
    scan(dir)
    return found.sort()
  },
}

/** An in-memory tree. Keys are paths relative to `root`. */
function memoryFs(root: string, files: Record<string, string>): SourceFs {
  const absolute = new Map(Object.entries(files).map(([name, text]) => [join(root, name), text]))
  return {
    read: path => absolute.get(path) ?? null,
    isFile: path => absolute.has(path),
    listCode: dir =>
      [...absolute.keys()].filter(path => path.startsWith(`${dir}/`) && isCodeFile(path)).sort(),
  }
}

type Target =
  | { type: 'file'; id: string; path: string }
  | { type: 'asset'; id: string; path: string }
  | { type: 'package'; id: string; name: string }
  | { type: 'builtin'; id: string; name: string }
  | { type: 'unresolved' }

type ViolationKind = 'forbidden-file' | 'server-module' | 'forbidden-package' | 'node-builtin'

interface Hop {
  from: string
  to: string
  kind: EdgeKind
  specifier: string
}

interface Violation {
  kind: ViolationKind
  /** A project-relative path, a package name, or the built-in's specifier. */
  target: string
  /** The import chain from the walk's entry to `target`, shortest first. */
  hops: Hop[]
}

interface Walk {
  /** Project-relative path of the entry module. */
  entry: string
  /** Every local code module reached, the entry included (project-relative). */
  files: Set<string>
  packages: Set<string>
  builtins: Set<string>
  assets: Set<string>
  /** Every runtime edge followed, one per (importer, kind, specifier). */
  edges: Hop[]
  violations: Violation[]
  /** Local specifiers that resolve to no file: the walker would be blind past them. */
  unresolved: Array<{ from: string; specifier: string; kind: EdgeKind }>
  /** `import(expr)` / `require(expr)` with a non-literal argument. */
  computed: Array<{ from: string; kind: 'dynamic' | 'require'; expression: string }>
}

function packageNameOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function describeHop(hop: Hop): string {
  return `${hop.from}  --${hop.kind} '${hop.specifier}'-->  ${hop.to}`
}

function describeViolation(violation: Violation): string {
  return [
    `${violation.kind}: ${violation.target}`,
    ...violation.hops.map(hop => `    ${describeHop(hop)}`),
  ].join('\n')
}

function createWalker(fs: SourceFs, root: string) {
  const cache = new Map<string, ParsedModule | null>()

  function parse(path: string): ParsedModule | null {
    if (!cache.has(path)) {
      const text = fs.read(path)
      cache.set(path, text === null ? null : parseModule(path, text))
    }
    return cache.get(path) ?? null
  }

  function resolveLocal(base: string): string | null {
    const tries = [base, ...CODE_EXTENSIONS.map(ext => base + ext)]
    // TypeScript's `import './x.js'` that is really `x.ts`.
    const swapped = /^(.*)\.[cm]?jsx?$/.exec(base)
    if (swapped) tries.push(...['.ts', '.tsx', '.mts', '.cts'].map(ext => swapped[1] + ext))
    tries.push(...CODE_EXTENSIONS.map(ext => join(base, `index${ext}`)))
    return tries.find(candidate => fs.isFile(candidate)) ?? null
  }

  function resolveSpecifier(specifier: string, from: string): Target {
    if (specifier.startsWith('node:')) {
      return { type: 'builtin', id: `builtin:${specifier}`, name: specifier }
    }
    const isLocal =
      specifier.startsWith('@/') ||
      specifier === '.' ||
      specifier === '..' ||
      specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier.startsWith('/')
    if (isLocal) {
      const base = specifier.startsWith('@/')
        ? join(root, specifier.slice(2))
        : specifier.startsWith('/')
          ? specifier
          : resolvePath(dirname(from), specifier)
      const hit = resolveLocal(base)
      if (hit === null) return { type: 'unresolved' }
      return isCodeFile(hit)
        ? { type: 'file', id: hit, path: hit }
        : { type: 'asset', id: `asset:${hit}`, path: hit }
    }
    const name = packageNameOf(specifier)
    if (NODE_BUILTINS.has(specifier)) {
      return { type: 'builtin', id: `builtin:${specifier}`, name: specifier }
    }
    return { type: 'package', id: `package:${name}`, name }
  }

  function violationFor(target: Target): { kind: ViolationKind; target: string } | null {
    switch (target.type) {
      case 'file': {
        const display = relative(root, target.path)
        if (FORBIDDEN_FILES.includes(display)) return { kind: 'forbidden-file', target: display }
        if (SERVER_MODULE.test(display)) return { kind: 'server-module', target: display }
        return null
      }
      case 'package':
        return FORBIDDEN_PACKAGES.includes(target.name) ||
          FORBIDDEN_SCOPES.some(scope => target.name.startsWith(scope))
          ? { kind: 'forbidden-package', target: target.name }
          : null
      case 'builtin':
        return { kind: 'node-builtin', target: target.name }
      default:
        return null
    }
  }

  function walk(entryPath: string): Walk {
    const display = (path: string): string => relative(root, path)
    const result: Walk = {
      entry: display(entryPath),
      files: new Set([display(entryPath)]),
      packages: new Set(),
      builtins: new Set(),
      assets: new Set(),
      edges: [],
      violations: [],
      unresolved: [],
      computed: [],
    }
    // How each node was first reached: BFS, so the recorded chain is the shortest one.
    const arrivedBy = new Map<string, { fromId: string; hop: Hop } | null>([[entryPath, null]])
    const seenEdges = new Set<string>()
    const labelOf = (target: Exclude<Target, { type: 'unresolved' }>): string =>
      target.type === 'file' || target.type === 'asset' ? display(target.path) : target.name
    const chainTo = (fromId: string, last: Hop): Hop[] => {
      const hops = [last]
      for (let id = fromId, arrival = arrivedBy.get(id); arrival; arrival = arrivedBy.get(id)) {
        hops.unshift(arrival.hop)
        id = arrival.fromId
      }
      return hops
    }

    const queue = [entryPath]
    while (queue.length > 0) {
      const current = queue.shift() as string
      const module = parse(current)
      if (!module) continue
      for (const ref of module.runtime) {
        const target = resolveSpecifier(ref.specifier, current)
        if (target.type === 'unresolved') {
          result.unresolved.push({ from: display(current), ...ref })
          continue
        }
        const hop: Hop = {
          from: display(current),
          to: labelOf(target),
          kind: ref.kind,
          specifier: ref.specifier,
        }
        const edgeKey = `${hop.from}|${hop.kind}|${hop.specifier}`
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey)
          result.edges.push(hop)
        }
        if (arrivedBy.has(target.id)) continue
        arrivedBy.set(target.id, { fromId: current, hop })
        if (target.type === 'file') {
          result.files.add(display(target.path))
          queue.push(target.path)
        } else if (target.type === 'package') {
          result.packages.add(target.name)
        } else if (target.type === 'builtin') {
          result.builtins.add(target.name)
        } else {
          result.assets.add(display(target.path))
        }
        const violation = violationFor(target)
        if (violation) result.violations.push({ ...violation, hops: chainTo(current, hop) })
      }
      for (const entry of module.computed) {
        result.computed.push({ from: display(current), ...entry })
      }
    }
    return result
  }

  /** The `*.server.*` modules among a module's direct runtime imports. */
  function directServerImports(path: string): Array<{ specifier: string; kind: EdgeKind }> {
    const module = parse(path)
    if (!module) return []
    return module.runtime.filter(ref => {
      const target = resolveSpecifier(ref.specifier, path)
      return target.type === 'file' && SERVER_MODULE.test(target.path)
    })
  }

  /** `'use client'` modules under `dirs` that import a `*.server.*` module directly. */
  function clientModulesImportingServer(dirs: string[]): string[] {
    const offenders: string[] = []
    for (const dir of dirs) {
      for (const path of fs.listCode(dir)) {
        // Cheap prefilter: only parse what could carry the directive.
        if (!fs.read(path)?.includes('use client')) continue
        if (!parse(path)?.useClient) continue
        for (const ref of directServerImports(path)) {
          offenders.push(`${relative(root, path)} --${ref.kind} '${ref.specifier}'`)
        }
      }
    }
    return offenders
  }

  return { parse, walk, resolveSpecifier, directServerImports, clientModulesImportingServer }
}

// ─── The real tree ───────────────────────────────────────────────────────────

const real = createWalker(diskFs, ROOT)
const RATING_DIR = join(ROOT, 'lib/agents/rating')

/** Every `lib/agents/rating/*.ts(x)` except the `.server` modules, plus the spacetime hooks. */
const ROOTS: string[] = [
  ...readdirSync(RATING_DIR)
    .filter(name => /\.tsx?$/.test(name) && !name.endsWith('.d.ts') && !SERVER_MODULE.test(name))
    .sort()
    .map(name => join(RATING_DIR, name)),
  join(ROOT, 'lib/spacetime/derive-live-ephemeris.ts'),
  join(ROOT, 'lib/spacetime/hooks/useLiveEphemeris.ts'),
]
const SERVER_STORE = join(RATING_DIR, 'esms-ledger-store.server.ts')
const INDEX = join(RATING_DIR, 'index.ts')

const walks = new Map<string, Walk>()
function realWalk(path: string): Walk {
  let walk = walks.get(path)
  if (!walk) {
    walk = real.walk(path)
    walks.set(path, walk)
  }
  return walk
}

const rel = (path: string): string => relative(ROOT, path)

describe('rating modules are safe to import from a client component', () => {
  it('walks every rating module and the spacetime hooks', () => {
    const names = ROOTS.map(rel)
    for (const expected of [
      'lib/agents/rating/index.ts',
      'lib/agents/rating/esms-balance-resolver.ts',
      'lib/agents/rating/live-sky.ts',
      'lib/agents/rating/seals-surge.ts',
      'lib/agents/rating/vessel-payload.ts',
      'lib/spacetime/derive-live-ephemeris.ts',
      'lib/spacetime/hooks/useLiveEphemeris.ts',
    ]) {
      expect(names).toContain(expected)
    }
    // The server module is the one thing a client must not import: it is not a root.
    expect(names.some(name => SERVER_MODULE.test(name))).toBe(false)
  })

  describe.each(ROOTS.map(rel))('%s', name => {
    const walk = () => realWalk(join(ROOT, name))

    it('reaches no database, Prisma, Redis, server-only module or Node built-in', () => {
      expect(walk().violations.map(describeViolation)).toEqual([])
    })

    it('has every local import resolved, so the walk is not blind past a missing file', () => {
      expect(walk().unresolved).toEqual([])
    })

    it('has no import() or require() with a computed argument in its own graph', () => {
      expect(walk().computed).toEqual([])
    })
  })

  it('has no root, and nothing a root reaches, that is a *.server module', () => {
    const reached = new Set(ROOTS.flatMap(path => [...realWalk(path).files]))
    expect([...reached].filter(file => SERVER_MODULE.test(file))).toEqual([])
    for (const path of ROOTS) {
      expect(real.directServerImports(path)).toEqual([])
    }
  })

  it('does not re-export a .server module from the barrel', () => {
    const barrel = real.parse(INDEX)
    expect(barrel).not.toBeNull()
    const reExports = (barrel?.runtime ?? []).filter(ref => ref.kind === 're-export')
    // A barrel that parsed to nothing would pass trivially.
    expect(reExports.length).toBeGreaterThanOrEqual(5)
    expect(reExports.filter(ref => /server/i.test(ref.specifier))).toEqual([])
    expect(real.directServerImports(INDEX)).toEqual([])
  })

  it('has the .server module the barrel must leave out', () => {
    expect(diskFs.isFile(SERVER_STORE)).toBe(true)
    expect(real.parse(INDEX)?.runtime.some(ref => /ledger-store/.test(ref.specifier))).toBe(false)
  })

  // Reads every source file under four directories, so allow for a loaded machine.
  it("has no 'use client' module that imports a .server module", () => {
    const scanned = ['app', 'components', 'hooks', 'lib'].map(dir => join(ROOT, dir))
    expect(real.clientModulesImportingServer(scanned)).toEqual([])
  }, 30_000)
})

describe('the walk can see what it must', () => {
  it('reaches a non-trivial graph from the barrel, kalchm included', () => {
    const { files } = realWalk(INDEX)
    expect(files.size).toBeGreaterThan(20)
    expect(files.has('lib/thermodynamics/kalchm.ts')).toBe(true)
    for (const member of [
      'ovr-archetype',
      'seals-surge',
      'pentacle-contest',
      'esms-balance-resolver',
      'live-sky',
      'vessel-payload',
    ]) {
      expect(files.has(`lib/agents/rating/${member}.ts`)).toBe(true)
    }
    // The look is the contract's manifest now; ASOL's own appearance registry is gone.
    expect(files.has('lib/agents/rating/vessel-appearance.ts')).toBe(false)
  })

  it('reaches the rating contract and the appearance manifest it feeds', () => {
    const { files, edges } = realWalk(INDEX)
    expect(files.has('lib/agents/rating-contract.ts')).toBe(true)
    expect(files.has('lib/agents/vessel-appearance-manifest.ts')).toBe(true)
    // ...by a direct value import from each module that calls them, not merely transitively: a
    // module that stopped importing the contract would still reach it through its neighbours.
    const direct = (from: string, to: string): boolean =>
      edges.some(edge => edge.from === from && edge.to === to)
    for (const member of ['ovr-archetype', 'seals-surge', 'pentacle-contest', 'vessel-payload']) {
      expect(
        direct(`lib/agents/rating/${member}.ts`, 'lib/agents/rating-contract.ts'),
        member
      ).toBe(true)
    }
    expect(
      direct('lib/agents/rating/vessel-payload.ts', 'lib/agents/vessel-appearance-manifest.ts')
    ).toBe(true)
    // The contract feeds on the manifest, and nothing reaches back the other way.
    expect(
      direct('lib/agents/rating-contract.ts', 'lib/agents/vessel-appearance-manifest.ts')
    ).toBe(true)
    expect(
      direct('lib/agents/vessel-appearance-manifest.ts', 'lib/agents/rating-contract.ts')
    ).toBe(false)
  })

  it('keeps the contract and the manifest free of the server-only edges', () => {
    for (const file of [
      'lib/agents/rating-contract.ts',
      'lib/agents/vessel-appearance-manifest.ts',
    ]) {
      const walk = realWalk(join(ROOT, file))
      expect(walk.violations.map(describeViolation), file).toEqual([])
      expect(walk.unresolved, file).toEqual([])
    }
  })

  it('follows static, re-export and dynamic edges in the real tree', () => {
    const kinds = new Set(realWalk(INDEX).edges.map(edge => edge.kind))
    expect(kinds.has('import')).toBe(true)
    expect(kinds.has('re-export')).toBe(true)
    expect(kinds.has('dynamic')).toBe(true)
  })

  it('reaches at least one module only through a dynamic import()', () => {
    const { edges, files } = realWalk(INDEX)
    const incoming = new Map<string, Set<EdgeKind>>()
    for (const edge of edges) {
      if (!files.has(edge.to)) continue
      incoming.set(edge.to, (incoming.get(edge.to) ?? new Set()).add(edge.kind))
    }
    const dynamicOnly = [...incoming].filter(
      ([, kinds]) => kinds.size === 1 && kinds.has('dynamic')
    )
    // If the walker ignored import(), this module would be missing from `files` altogether.
    expect(dynamicOnly.map(([file]) => file)).not.toEqual([])
  })

  it('sees the server store reach lib/db.ts through its dynamic import, and server-only', () => {
    const walk = realWalk(SERVER_STORE)
    const database = walk.violations.find(v => v.target === 'lib/db.ts')
    expect(database?.kind).toBe('forbidden-file')
    expect(database?.hops.map(hop => hop.kind)).toEqual(['dynamic'])
    expect(database?.hops[0].from).toBe('lib/agents/rating/esms-ledger-store.server.ts')
    const serverOnly = walk.violations.find(v => v.target === 'server-only')
    expect(serverOnly?.kind).toBe('forbidden-package')
    expect(serverOnly?.hops.map(hop => hop.kind)).toEqual(['side-effect'])
    // The walk does not stop at a forbidden module: it is part of the reachable set.
    expect(walk.files.has('lib/db.ts')).toBe(true)
  })
})

// ─── The walker, proven on fixtures ──────────────────────────────────────────

describe('the walker (in-memory fixtures)', () => {
  const VROOT = '/virtual'
  const walkerFor = (files: Record<string, string>) => createWalker(memoryFs(VROOT, files), VROOT)
  const violationsOf = (files: Record<string, string>, entry = 'entry.ts') =>
    walkerFor(files).walk(join(VROOT, entry)).violations

  /** `lib/db.ts` as the policy sees it: server-only, Prisma, Redis. */
  const DB = `import 'server-only'\nimport Redis from 'ioredis'\nexport const prisma = new Redis()\n`

  describe('flags', () => {
    it("a dynamic import('@/lib/db')", () => {
      const violations = violationsOf({
        'entry.ts': `export async function load() { return (await import('@/lib/db')).prisma }`,
        'lib/db.ts': DB,
      })
      const database = violations.find(v => v.target === 'lib/db.ts')
      expect(database?.kind).toBe('forbidden-file')
      expect(database?.hops).toEqual([
        { from: 'entry.ts', to: 'lib/db.ts', kind: 'dynamic', specifier: '@/lib/db' },
      ])
      // ...and what lib/db.ts itself pulls in, one hop deeper.
      const serverOnly = violations.find(v => v.target === 'server-only')
      expect(serverOnly?.hops.map(hop => hop.kind)).toEqual(['dynamic', 'side-effect'])
      expect(violations.find(v => v.target === 'ioredis')?.hops.map(hop => hop.kind)).toEqual([
        'dynamic',
        'import',
      ])
    })

    it('a dynamic import written with a template literal and no substitution', () => {
      const violations = violationsOf({
        'entry.ts': 'export const load = () => import(`@/lib/db`)',
        'lib/db.ts': DB,
      })
      expect(violations.map(v => v.target)).toContain('lib/db.ts')
    })

    it("an unguarded and a typeof-window-guarded dynamic import('@/lib/db')", () => {
      // The reviewer's case: the guard is folded away in the browser layer only.
      const violations = violationsOf({
        'entry.ts': `
          export async function load() {
            if (typeof window === 'undefined') {
              const { prisma } = await import('@/lib/db')
              return prisma
            }
            return null
          }`,
        'lib/db.ts': DB,
      })
      expect(violations.map(v => v.target)).toContain('lib/db.ts')
    })

    it("an `export * from` that reaches 'node:crypto'", () => {
      const violations = violationsOf({
        'entry.ts': `export * from './inner'`,
        'inner.ts': `import { createHash } from 'node:crypto'\nexport const h = createHash`,
      })
      expect(violations).toEqual([
        {
          kind: 'node-builtin',
          target: 'node:crypto',
          hops: [
            { from: 'entry.ts', to: 'inner.ts', kind: 're-export', specifier: './inner' },
            { from: 'inner.ts', to: 'node:crypto', kind: 'import', specifier: 'node:crypto' },
          ],
        },
      ])
    })

    it.each([
      ["export * from '@/lib/db'", 'lib/db.ts', 're-export'],
      ["export { prisma } from '@/lib/db'", 'lib/db.ts', 're-export'],
      ["export * as database from '@/lib/db'", 'lib/db.ts', 're-export'],
      ["export { PrismaClient } from '@prisma/client'", '@prisma/client', 're-export'],
      ["export { a, type B } from 'node:fs'", 'node:fs', 're-export'],
      ["export { default } from 'ioredis'", 'ioredis', 're-export'],
    ])('a value re-export: %s', (source, target, kind) => {
      const violations = violationsOf({ 'entry.ts': source, 'lib/db.ts': DB })
      const hit = violations.find(v => v.target === target)
      expect(hit?.hops.at(-1)?.kind).toBe(kind)
    })

    it.each([
      ["import { createHash } from 'node:crypto'", 'node:crypto'],
      ["import fs from 'fs'", 'fs'],
      ["import { readFile } from 'fs/promises'", 'fs/promises'],
      ["import { join } from 'path'", 'path'],
      ["import { randomBytes } from 'crypto'", 'crypto'],
      ["import { createRequire } from 'module'", 'module'],
      ["import os from 'os'", 'os'],
      ["import { Buffer } from 'buffer'", 'buffer'],
      ["import 'node:test'", 'node:test'],
      ["import * as net from 'node:net'", 'node:net'],
    ])('a Node built-in: %s', (source, target) => {
      const violations = violationsOf({ 'entry.ts': source })
      expect(violations).toHaveLength(1)
      expect(violations[0].kind).toBe('node-builtin')
      expect(violations[0].target).toBe(target)
    })

    it.each([
      ["import 'server-only'", 'server-only', 'side-effect'],
      ["import { prisma } from '@/lib/db'", 'lib/db.ts', 'import'],
      ["import { PrismaClient } from '@prisma/client'", '@prisma/client', 'import'],
      [
        "import { withAccelerate } from '@prisma/extension-accelerate'",
        '@prisma/extension-accelerate',
        'import',
      ],
      ["import { x } from '@prisma/client/runtime/library'", '@prisma/client', 'import'],
      ["import { Pool } from 'pg'", 'pg', 'import'],
      ["import { x } from 'pg/lib/client'", 'pg', 'import'],
      ["import Redis from 'ioredis'", 'ioredis', 'import'],
      ["import * as db from '../lib/db'", 'lib/db.ts', 'import'],
    ])('a forbidden module: %s', (source, target, kind) => {
      const files = { 'sub/entry.ts': source, 'lib/db.ts': DB }
      const violations = violationsOf(files, 'sub/entry.ts')
      const hit = violations.find(v => v.target === target)
      expect(hit).toBeDefined()
      expect(hit?.hops).toHaveLength(1)
      expect(hit?.hops[0].kind).toBe(kind)
    })

    it('a require() and an import-equals', () => {
      const violations = violationsOf({
        'entry.ts': `const pg = require('pg')\nimport fs = require('node:fs')\nexport { pg, fs }`,
      })
      const byTarget = new Map(violations.map(v => [v.target, v.hops[0].kind]))
      expect(byTarget.get('pg')).toBe('require')
      expect(byTarget.get('node:fs')).toBe('import-equals')
    })

    it('a mixed import: one value specifier among the types', () => {
      const violations = violationsOf({
        'entry.ts': `import { type A, b } from 'node:fs'`,
      })
      expect(violations.map(v => v.target)).toEqual(['node:fs'])
    })

    it('a default import with inline type specifiers, which is still a value import', () => {
      const violations = violationsOf({ 'entry.ts': `import fs, { type Stats } from 'node:fs'` })
      expect(violations.map(v => v.target)).toEqual(['node:fs'])
    })

    it('an empty named import, conservatively, since it may keep the side effect', () => {
      expect(violationsOf({ 'entry.ts': `import {} from 'node:fs'` }).map(v => v.target)).toEqual([
        'node:fs',
      ])
    })

    it('a *.server module, wherever it is imported from', () => {
      const violations = violationsOf({
        'entry.ts': `import { loader } from './store.server'\nimport { x } from './panel.server.tsx'`,
        'store.server.ts': `export const loader = 1`,
        'panel.server.tsx': `export const x = 1`,
      })
      expect(violations.map(v => [v.kind, v.target])).toEqual([
        ['server-module', 'store.server.ts'],
        ['server-module', 'panel.server.tsx'],
      ])
    })

    it('a violation four modules down, with the whole chain and in order', () => {
      const violations = violationsOf({
        'entry.ts': `import { a } from './a'\nexport { a }`,
        'a.ts': `import { b } from './b'\nexport const a = b`,
        'b.ts': `export * from './c'`,
        'c.ts': `export const load = () => import('@/lib/db')`,
        'lib/db.ts': DB,
      })
      expect(violations.find(v => v.target === 'lib/db.ts')?.hops).toEqual([
        { from: 'entry.ts', to: 'a.ts', kind: 'import', specifier: './a' },
        { from: 'a.ts', to: 'b.ts', kind: 'import', specifier: './b' },
        { from: 'b.ts', to: 'c.ts', kind: 're-export', specifier: './c' },
        { from: 'c.ts', to: 'lib/db.ts', kind: 'dynamic', specifier: '@/lib/db' },
      ])
    })

    it('a failure message that prints the whole import chain', () => {
      const [violation] = violationsOf({
        'entry.ts': `export * from './a'`,
        'a.ts': `export const load = () => import('@/lib/db')`,
        'lib/db.ts': `export const prisma = 1`,
      })
      expect(describeViolation(violation)).toBe(
        [
          'forbidden-file: lib/db.ts',
          "    entry.ts  --re-export './a'-->  a.ts",
          "    a.ts  --dynamic '@/lib/db'-->  lib/db.ts",
        ].join('\n')
      )
    })

    it('a violation inside a cycle, and does not loop', () => {
      const violations = violationsOf({
        'entry.ts': `import './a'`,
        'a.ts': `import './b'`,
        'b.ts': `import './a'\nimport { createHash } from 'node:crypto'`,
      })
      expect(violations.map(v => v.target)).toEqual(['node:crypto'])
      expect(violations[0].hops).toHaveLength(3)
    })

    it.each([
      ['the short route listed first', `import './short'\nimport './long1'`],
      ['the long route listed first', `import './long1'\nimport './short'`],
    ])('a violation once, by its shortest chain, with %s', (_label, entry) => {
      const violations = violationsOf({
        'entry.ts': entry,
        'long1.ts': `import './long2'`,
        'long2.ts': `import 'node:fs'`,
        'short.ts': `import 'node:fs'`,
      })
      expect(violations).toHaveLength(1)
      expect(violations[0].hops.map(hop => hop.from)).toEqual(['entry.ts', 'short.ts'])
    })

    it('a violation reachable only through a barrel that also has clean exports', () => {
      const violations = violationsOf({
        'entry.ts': `export * from './clean'\nexport * from './dirty'`,
        'clean.ts': `export const ok = 1`,
        'dirty.ts': `export const f = () => import('node:fs')`,
      })
      expect(violations.map(v => v.target)).toEqual(['node:fs'])
    })
  })

  describe('ignores', () => {
    it.each([
      "import type { PrismaClient } from '@prisma/client'",
      "import type { prisma } from '@/lib/db'",
      "import type fs from 'node:fs'",
      "import type * as db from '@/lib/db'",
      "import { type A, type B } from '@/lib/db'",
      "import { type A } from 'node:fs'",
      "export type { A } from '@/lib/db'",
      "export type * from '@/lib/db'",
      "export type * as ns from '@/lib/db'",
      "export { type A } from 'node:fs'",
      "export { type A, type B } from '@prisma/client'",
      "import type db = require('@/lib/db')",
      "export type Db = typeof import('@/lib/db')",
      "export type Prisma = import('@prisma/client').PrismaClient",
    ])('a type-only edge: %s', source => {
      const walk = walkerFor({ 'entry.ts': source, 'lib/db.ts': DB }).walk(join(VROOT, 'entry.ts'))
      expect(walk.violations).toEqual([])
      // Not walked at all: the erased module is not part of the reachable set.
      expect([...walk.files]).toEqual(['entry.ts'])
      expect(walk.edges).toEqual([])
    })

    it('records the type-only edges it skipped, so the skip is visible', () => {
      const parsed = parseModule(
        'entry.ts',
        `import type { A } from 'a'\nexport type { B } from 'b'\nimport { type C } from 'c'\nimport type D = require('d')\nimport { value } from 'e'`
      )
      expect(parsed.typeOnly.map(ref => ref.specifier)).toEqual(['a', 'b', 'c', 'd'])
      expect(parsed.runtime.map(ref => ref.specifier)).toEqual(['e'])
    })

    it('a mention of a forbidden module in a string, a comment or an identifier', () => {
      const violations = violationsOf({
        'entry.ts': `
          // import 'server-only'
          /* const x = require('pg') */
          export const note = "import { a } from 'node:fs'"
          export const server_only = 'import(\\'@/lib/db\\')'
          export const template = \`require('ioredis')\`
        `,
      })
      expect(violations).toEqual([])
    })

    it('a clean graph: nothing is flagged and every module is reached', () => {
      const walk = walkerFor({
        'entry.ts': `import { a } from './a'\nimport React from 'react'\nexport * from './b'\nexport { a, React }`,
        'a.ts': `import { b } from '@/b'\nexport const a = b`,
        'b.ts': `export const b = 1`,
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.violations).toEqual([])
      expect([...walk.files].sort()).toEqual(['a.ts', 'b.ts', 'entry.ts'])
      expect([...walk.packages]).toEqual(['react'])
      // One edge per distinct import, even when one module imports several of the same kind.
      expect(walk.edges.map(edge => `${edge.from} --${edge.kind}--> ${edge.to}`)).toEqual([
        'entry.ts --import--> a.ts',
        'entry.ts --import--> react',
        'entry.ts --re-export--> b.ts',
        'a.ts --import--> b.ts',
      ])
    })
  })

  describe('resolves', () => {
    it('the @/ alias from the project root, and relative paths from the importer', () => {
      const walk = walkerFor({
        'entry.ts': `import '@/lib/a'\nimport './sibling'\nimport './nested/inner'`,
        'lib/a.ts': `import '../up'`,
        'up.ts': ``,
        'sibling.ts': ``,
        'nested/inner.ts': `import '../sibling'\nimport './deeper/leaf'`,
        'nested/deeper/leaf.ts': ``,
      }).walk(join(VROOT, 'entry.ts'))
      expect([...walk.files].sort()).toEqual([
        'entry.ts',
        'lib/a.ts',
        'nested/deeper/leaf.ts',
        'nested/inner.ts',
        'sibling.ts',
        'up.ts',
      ])
      expect(walk.unresolved).toEqual([])
    })

    it('.ts, .tsx, .js, a directory index and a TypeScript-style .js specifier', () => {
      const walk = walkerFor({
        'entry.ts': [
          `import './plain'`,
          `import './view'`,
          `import './legacy'`,
          `import './dir'`,
          `import './dir-tsx'`,
          `import './esm.js'`,
        ].join('\n'),
        'plain.ts': ``,
        'view.tsx': ``,
        'legacy.js': ``,
        'dir/index.ts': ``,
        'dir-tsx/index.tsx': ``,
        'esm.ts': ``,
      }).walk(join(VROOT, 'entry.ts'))
      expect([...walk.files].sort()).toEqual([
        'dir-tsx/index.tsx',
        'dir/index.ts',
        'entry.ts',
        'esm.ts',
        'legacy.js',
        'plain.ts',
        'view.tsx',
      ])
      expect(walk.unresolved).toEqual([])
    })

    it('prefers a file over a directory of the same name', () => {
      const walk = walkerFor({
        'entry.ts': `import './thing'`,
        'thing.ts': `import 'node:fs'`,
        'thing/index.ts': ``,
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.files.has('thing.ts')).toBe(true)
      expect(walk.files.has('thing/index.ts')).toBe(false)
      expect(walk.violations.map(v => v.target)).toEqual(['node:fs'])
    })

    it('non-code files as leaves that are not parsed', () => {
      const walk = walkerFor({
        'entry.ts': `import data from './data.json'\nimport './style.css'`,
        'data.json': `{ "import": "node:fs" }`,
        'style.css': `@import 'node:fs';`,
      }).walk(join(VROOT, 'entry.ts'))
      expect([...walk.assets].sort()).toEqual(['data.json', 'style.css'])
      expect(walk.violations).toEqual([])
      expect([...walk.files]).toEqual(['entry.ts'])
    })

    it('packages as leaves, by package name, and does not confuse near-names', () => {
      const walk = walkerFor({
        'entry.ts': [
          `import 'react'`,
          `import 'react/jsx-runtime'`,
          `import 'next/navigation'`,
          `import '@scope/pkg/deep/path'`,
          `import 'path-to-regexp'`,
          `import 'fs-extra'`,
          `import 'pg-types'`,
          `import 'pgx'`,
          `import 'server-only-lookalike'`,
          `import 'ioredis-mock'`,
          `import '@prismatic/ui'`,
          `import 'crypto-js'`,
          `import 'util-deprecate'`,
          `import 'os-name'`,
        ].join('\n'),
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.violations).toEqual([])
      expect([...walk.packages].sort()).toEqual([
        '@prismatic/ui',
        '@scope/pkg',
        'crypto-js',
        'fs-extra',
        'ioredis-mock',
        'next',
        'os-name',
        'path-to-regexp',
        'pg-types',
        'pgx',
        'react',
        'server-only-lookalike',
        'util-deprecate',
      ])
    })
  })

  describe('reports what it cannot see', () => {
    it('a local import that resolves to no file', () => {
      const walk = walkerFor({
        'entry.ts': `import './missing'\nimport '@/nowhere/at-all'\nexport const x = () => import('../gone')`,
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.unresolved).toEqual([
        { from: 'entry.ts', specifier: './missing', kind: 'side-effect' },
        { from: 'entry.ts', specifier: '@/nowhere/at-all', kind: 'side-effect' },
        { from: 'entry.ts', specifier: '../gone', kind: 'dynamic' },
      ])
      expect(walk.violations).toEqual([])
    })

    it('a dynamic import() or require() with a computed argument', () => {
      const walk = walkerFor({
        'entry.ts': [
          'const name = Math.random() > 1 ? "a" : "b"',
          'export const one = () => import(name)',
          'export const two = () => import(`./${name}`)',
          'export const three = () => require("./" + name)',
          'export const four = () => import("./literal")',
        ].join('\n'),
        'literal.ts': ``,
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.computed).toEqual([
        { from: 'entry.ts', kind: 'dynamic', expression: 'name' },
        { from: 'entry.ts', kind: 'dynamic', expression: '`./${name}`' },
        { from: 'entry.ts', kind: 'require', expression: '"./" + name' },
      ])
      expect(walk.files.has('literal.ts')).toBe(true)
    })

    it('a computed import in a module reached only transitively', () => {
      const walk = walkerFor({
        'entry.ts': `import './a'`,
        'a.ts': `export const f = (n: string) => import(n)`,
      }).walk(join(VROOT, 'entry.ts'))
      expect(walk.computed.map(entry => entry.from)).toEqual(['a.ts'])
    })
  })

  describe('reads the directive', () => {
    it.each([
      ["'use client'\nimport 'x'", true],
      ['"use client"\nexport const a = 1', true],
      ["'use strict'\n'use client'\nexport const a = 1", true],
      ["import 'x'\n'use client'", false],
      ["// 'use client'\nexport const a = 1", false],
      ["export const a = 'use client'", false],
      ["'use server'\nexport const a = 1", false],
    ])('%j -> %s', (source, expected) => {
      expect(parseModule('m.ts', source).useClient).toBe(expected)
    })
  })

  describe('finds a client module that imports a .server module', () => {
    const files = {
      'components/Client.tsx': `'use client'\nimport { loader } from '@/lib/store.server'\nexport const C = () => loader`,
      'components/ClientRel.tsx': `'use client'\nexport { loader } from '../lib/store.server'`,
      'components/ClientTypes.tsx': `'use client'\nimport type { Loader } from '@/lib/store.server'\nexport type L = Loader`,
      'components/ClientClean.tsx': `'use client'\nimport { a } from '@/lib/a'\nexport const C = a`,
      'app/route.ts': `import { loader } from '@/lib/store.server'\nexport const GET = loader`,
      // Mentions the directive without carrying it, and imports the server module.
      'app/note.ts': `// not a 'use client' module\nimport { loader } from '@/lib/store.server'\nexport const N = loader`,
      'lib/store.server.ts': `import 'server-only'\nexport const loader = 1`,
      'lib/a.ts': `export const a = 1`,
    }

    it('and only one that is a client module and imports it as a value', () => {
      const offenders = walkerFor(files).clientModulesImportingServer([
        join(VROOT, 'components'),
        join(VROOT, 'app'),
        join(VROOT, 'lib'),
      ])
      expect(offenders).toEqual([
        "components/Client.tsx --import '@/lib/store.server'",
        "components/ClientRel.tsx --re-export '../lib/store.server'",
      ])
    })

    it('and finds nothing in a tree without one', () => {
      const clean = { ...files }
      delete (clean as Record<string, string>)['components/Client.tsx']
      delete (clean as Record<string, string>)['components/ClientRel.tsx']
      expect(walkerFor(clean).clientModulesImportingServer([join(VROOT, 'components')])).toEqual([])
    })
  })
})

describe('the walker (files on disk)', () => {
  const dirs: string[] = []
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  function tree(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'rating-client-safe-'))
    dirs.push(dir)
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true })
      writeFileSync(join(dir, name), text)
    }
    return dir
  }

  it('follows the same edges through the real file system', () => {
    const dir = tree({
      'lib/agents/rating/index.ts': `export * from './live'\nexport * from './safe'`,
      'lib/agents/rating/live.ts': `export const load = () => import('@/lib/db')`,
      'lib/agents/rating/safe.ts': `import type { PrismaClient } from '@prisma/client'\nimport { b } from '../../barrel'\nexport const s = b`,
      'lib/barrel/index.ts': `export const b = 1`,
      'lib/db.ts': `import 'server-only'\nimport { PrismaClient } from '@prisma/client'\nexport const prisma = new PrismaClient()`,
    })
    const walk = createWalker(diskFs, dir).walk(join(dir, 'lib/agents/rating/index.ts'))
    expect([...walk.files].sort()).toEqual([
      'lib/agents/rating/index.ts',
      'lib/agents/rating/live.ts',
      'lib/agents/rating/safe.ts',
      'lib/barrel/index.ts',
      'lib/db.ts',
    ])
    expect(walk.violations.map(v => [v.kind, v.target])).toEqual([
      ['forbidden-file', 'lib/db.ts'],
      ['forbidden-package', 'server-only'],
      ['forbidden-package', '@prisma/client'],
    ])
    expect(walk.violations[0].hops.map(hop => hop.kind)).toEqual(['re-export', 'dynamic'])
  })

  it('lists code files under a directory and skips node_modules', () => {
    const dir = tree({
      'a.ts': '',
      'b.tsx': '',
      'c.d.ts': '',
      'notes.md': '',
      'deep/er/d.js': '',
      'node_modules/pkg/index.js': '',
      '.next/server/page.js': '',
    })
    expect(diskFs.listCode(dir).map(path => relative(dir, path))).toEqual([
      'a.ts',
      'b.tsx',
      'deep/er/d.js',
    ])
  })

  it('reports a missing entry as an empty walk instead of throwing', () => {
    const dir = tree({ 'present.ts': '' })
    const walk = createWalker(diskFs, dir).walk(join(dir, 'absent.ts'))
    expect(walk.violations).toEqual([])
    expect([...walk.files]).toEqual(['absent.ts'])
  })
})
