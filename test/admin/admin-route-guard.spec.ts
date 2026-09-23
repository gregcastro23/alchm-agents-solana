// @vitest-environment node
/**
 * Every exported handler under app/api/admin/** must reach an admin guard
 * before doing anything — directly, or through a helper in the same file that
 * does. A new admin route without one fails here instead of shipping open.
 */
import fs from 'node:fs'
import path from 'node:path'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../..')
const ADMIN_API = path.join(ROOT, 'app/api/admin')
const GUARDS = ['requireAdmin', 'requireAdminRequest', 'requireAdminOrService']
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name === 'route.ts' ? [full] : []
  })
}

/** Names called anywhere inside `node`. */
function calledNames(node: ts.Node): Set<string> {
  const names = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) names.add(n.expression.text)
    ts.forEachChild(n, visit)
  }
  visit(node)
  return names
}

function unguardedHandlers(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const localFns = new Map<string, ts.Node>()
  const handlers: Array<{ name: string; node: ts.Node }> = []

  for (const stmt of sf.statements) {
    const exported = ts.getCombinedModifierFlags(stmt as ts.Declaration) & ts.ModifierFlags.Export
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      localFns.set(stmt.name.text, stmt)
      if (exported && METHODS.has(stmt.name.text))
        handlers.push({ name: stmt.name.text, node: stmt })
    }
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue
        localFns.set(d.name.text, d.initializer)
        if (exported && METHODS.has(d.name.text))
          handlers.push({ name: d.name.text, node: d.initializer })
      }
    }
  }

  const guarded = (node: ts.Node, seen = new Set<string>()): boolean => {
    for (const name of calledNames(node)) {
      if (GUARDS.includes(name)) return true
      const local = localFns.get(name)
      if (local && !seen.has(name)) {
        seen.add(name)
        if (guarded(local, seen)) return true
      }
    }
    return false
  }

  return handlers.filter(h => !guarded(h.node)).map(h => `${path.relative(ROOT, file)} ${h.name}`)
}

describe('admin API routes', () => {
  const files = routeFiles(ADMIN_API)

  it('found the admin routes', () => {
    expect(files.length).toBeGreaterThanOrEqual(20)
  })

  it('every exported handler reaches requireAdmin / requireAdminRequest / requireAdminOrService', () => {
    const open = files.flatMap(f => unguardedHandlers(f, fs.readFileSync(f, 'utf8')))
    expect(open).toEqual([])
  })

  it('the scan catches a handler without a guard, and follows local helpers', () => {
    expect(
      unguardedHandlers(
        path.join(ADMIN_API, 'x/route.ts'),
        `export async function GET() { return Response.json({ secret: 1 }) }`
      )
    ).toEqual(['app/api/admin/x/route.ts GET'])
    expect(
      unguardedHandlers(
        path.join(ADMIN_API, 'y/route.ts'),
        `async function gate() { return requireAdmin() }
         export async function POST() { await gate(); return Response.json({}) }`
      )
    ).toEqual([])
  })
})
