// @vitest-environment node
/**
 * Source scan: a shared secret must never be compared with ===, !==, == or !=.
 *
 * Those operators return as soon as the first byte differs, so response time
 * leaks how much of a guess was right. Every inbound check goes through
 * `lib/security/secure-compare.ts` (TS), `backend/secure_compare.py` (Python) or
 * `backend/src/utils/secure-compare.ts` (the Bun service) instead. WTEN has the
 * same guard in `src/lib/hooks/__tests__/secureCompare.test.ts`.
 *
 * TypeScript is scanned by AST (every binary equality expression); Python and
 * Rust by a line scan. A line that is a genuine non-secret comparison can opt
 * out with a trailing `secret-compare-ok: <reason>` comment.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../..')
const TS_ROOTS = ['app', 'lib', 'src', 'backend/src', 'server.ts', 'middleware.ts']
const PY_ROOT = 'backend'
const RUST_ROOT = 'pa-rust-backend/src'
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '__pycache__', 'target'])
const OPT_OUT = /secret-compare-ok:/

/** Names that carry a secret wherever they appear (identifiers or properties). */
// `signature` and `token` are deliberately absent: here they are Solana transaction
// signatures and token symbols far more often than secrets.
const SECRET_NAME = /secret|api_?key|hmac|passphrase|password/i
/** Generic local names that, in an auth check, hold the presented or expected secret. */
const AUTH_LOCALS = new Set([
  'expected',
  'provided',
  'supplied',
  'bearer',
  'bearerToken',
  'authHeader',
  'authorization',
])
const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
])

function walk(rel: string, exts: string[]): string[] {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return exts.some(e => abs.endsWith(e)) ? [abs] : []
  const out: string[] = []
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    out.push(...walk(path.join(rel, entry.name), exts))
  }
  return out
}

function isLiteralLike(node: ts.Expression): boolean {
  const n = ts.isParenthesizedExpression(node) ? node.expression : node
  return (
    ts.isStringLiteral(n) ||
    ts.isNoSubstitutionTemplateLiteral(n) ||
    ts.isNumericLiteral(n) ||
    n.kind === ts.SyntaxKind.TrueKeyword ||
    n.kind === ts.SyntaxKind.FalseKeyword ||
    n.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(n) && n.text === 'undefined') ||
    ts.isTypeOfExpression(n) ||
    (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand))
  )
}

/** Does this operand hold (or build) a shared secret? */
function carriesSecret(node: ts.Expression): boolean {
  const n = ts.isParenthesizedExpression(node) ? node.expression : node
  // `Bearer ${secret}` — the classic header comparison.
  if (ts.isTemplateExpression(n) && /^Bearer\s/.test(n.head.text)) return true
  if (ts.isIdentifier(n)) return SECRET_NAME.test(n.text) || AUTH_LOCALS.has(n.text)
  if (ts.isPropertyAccessExpression(n)) {
    if (n.name.text === 'length') return false
    return SECRET_NAME.test(n.name.text) || /process\.env\.\w*(TOKEN)\b/.test(n.getText())
  }
  if (ts.isElementAccessExpression(n)) return SECRET_NAME.test(n.argumentExpression.getText())
  return false
}

function scanTypeScript(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const lines = source.split('\n')
  const hits: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind)) {
      const { left, right } = node
      if (
        !isLiteralLike(left) &&
        !isLiteralLike(right) &&
        (carriesSecret(left) || carriesSecret(right))
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line
        if (!OPT_OUT.test(lines[line] ?? '')) {
          hits.push(`${path.relative(ROOT, file)}:${line + 1}: ${node.getText().slice(0, 120)}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

const PY_SECRET_OPERAND =
  /\b\w*(secret|api_key|password)\w*\b|\b(expected|provided|supplied|bearer|bearer_token|authorization)\b/i
const PY_LITERAL_RHS = /^\s*(["'fbr]|None\b|True\b|False\b|-?\d)/

function scanPython(file: string, source: string): string[] {
  const hits: string[] = []
  source.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '')
    if (OPT_OUT.test(raw) || !/[!=]=/.test(line)) return
    const m = /(\S+)\s*([!=]=)\s*(.+)$/.exec(line)
    if (!m) return
    const [, lhs, , rhs] = m
    if (PY_LITERAL_RHS.test(rhs!) || /^\s*["']/.test(lhs!)) return
    if (PY_SECRET_OPERAND.test(lhs!) || PY_SECRET_OPERAND.test(rhs!.split(/[:)\s]/)[0]!)) {
      hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${raw.trim().slice(0, 120)}`)
    }
  })
  return hits
}

function scanRust(file: string, source: string): string[] {
  const hits: string[] = []
  source.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '')
    if (OPT_OUT.test(raw)) return
    if (
      /[!=]=/.test(line) &&
      /(secret|api_key|bearer|token)\w*\s*[!=]=|[!=]=\s*\S*(secret|api_key|bearer)/i.test(line)
    ) {
      hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${raw.trim().slice(0, 120)}`)
    }
  })
  return hits
}

describe('shared secrets are compared in constant time', () => {
  it('TypeScript: no ===/!== against a secret in app/, lib/, src/, backend/src/, server.ts, middleware.ts', () => {
    const files = TS_ROOTS.flatMap(r => walk(r, ['.ts', '.tsx'])).filter(f => !f.endsWith('.d.ts'))
    expect(files.length).toBeGreaterThan(500) // the walk really covered the tree
    const hits = files.flatMap(f => scanTypeScript(f, fs.readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })

  it('Python: no ==/!= against a secret in backend/*.py', () => {
    const files = walk(PY_ROOT, ['.py']).filter(
      f => !path.basename(f).startsWith('test_') && !f.includes(`${path.sep}tests${path.sep}`)
    )
    expect(files.length).toBeGreaterThan(10)
    const hits = files.flatMap(f => scanPython(f, fs.readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })

  it('Rust: no ==/!= against a secret in pa-rust-backend/src', () => {
    const files = walk(RUST_ROOT, ['.rs'])
    expect(files.length).toBeGreaterThan(0)
    const hits = files.flatMap(f => scanRust(f, fs.readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})

describe('the scanner itself', () => {
  // Guards against a scanner that silently matches nothing.
  it('flags the historical patterns this PR removed', () => {
    const tsHits = scanTypeScript(
      path.join(ROOT, 'fixture.ts'),
      [
        'if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {}',
        'return header === secret || bearer === secret',
        'return provided === expected',
        'if (token !== expected) {}',
        'if (supplied !== expected) {}',
        'if (x === process.env.INTERNAL_API_SECRET) {}',
      ].join('\n')
    )
    expect(tsHits).toHaveLength(7) // line 2 holds two comparisons

    const pyHits = scanPython(
      path.join(ROOT, 'fixture.py'),
      [
        '    if x_internal_secret != INTERNAL_API_SECRET:',
        '    if not expected or provided != expected:',
        '    if PA_USER_API_KEY and api_key == PA_USER_API_KEY:',
      ].join('\n')
    )
    expect(pyHits).toHaveLength(3)

    expect(
      scanRust(path.join(ROOT, 'f.rs'), 'if provided != cfg.internal_api_secret {')
    ).toHaveLength(1)
  })

  it('ignores literal and non-secret comparisons', () => {
    expect(
      scanTypeScript(
        path.join(ROOT, 'fixture.ts'),
        [
          "const t = body.token === 'eth' ? 'eth' : 'usdc'",
          "if (typeof secret === 'string') {}",
          'if (secret === undefined) {}',
          'if (hmacBuf.length !== expectedBuf.length) {}',
          "if (process.env.TOKEN_CALCULATIONS_BACKEND === 'true') {}",
          'if (metric.key === other.key) {}',
        ].join('\n')
      )
    ).toEqual([])
    expect(
      scanPython(path.join(ROOT, 'f.py'), '    if tier != "free" and x:\n    if secret is None:')
    ).toEqual([])
  })
})
