// @vitest-environment node
/**
 * Vercel builds production on a 4-core / 8 GB machine, and `next build` must fit in it.
 *
 * Why: from 2026-10-24 every production build of main was SIGKILLed for running out of memory
 * mid-compile, leaving agents.alchm.kitchen on bd5db1c for nine merges. Measured under an 8 GB
 * cgroup: with a custom `webpack()` Next disables its build worker, so the server, edge and client
 * compilations share one process that passes 8 GB; and with a high heap ceiling V8 lets even the
 * server compilation alone reach 8.1 GB before collecting. The two settings below take the peak
 * to about 6.4 GB, and the build completes under an 8 GB cgroup.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config.mjs'

const ROOT = path.resolve(__dirname, '../..')
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as {
  buildCommand: string
}

describe('next build fits the Vercel build machine', () => {
  it('runs each webpack compilation in its own worker, as a custom webpack() turns it off', () => {
    // The premise: without the custom function Next would default the worker on by itself.
    expect(typeof nextConfig.webpack).toBe('function')
    expect(nextConfig.experimental?.webpackBuildWorker).toBe(true)
    expect(nextConfig.experimental?.webpackMemoryOptimizations).toBe(true)
  })

  it("caps the build's heap at 4 GB in Vercel's build command, keeping Vercel's own NODE_OPTIONS", () => {
    const [generate, build] = vercel.buildCommand.split('&&').map(part => part.trim())
    expect(generate).toBe('bun run prisma:generate')
    expect(build).toBe('NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=4096" bun run build')
  })
})
