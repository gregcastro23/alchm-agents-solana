// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  describeTarget,
  parseArgs,
  refusalReason,
  run,
  type ScrubClient,
} from '../../scripts/scrub-forged-aura-charts'

const URL = 'postgres://app_user:hunter2@db.example.test:5432/prod?sslmode=require'

interface State {
  forged: number
  withCharts: number
  elsewhere: number
  /** When true, the UPDATE reports success but leaves the rows as they were. */
  updateDoesNothing?: boolean
}

function fakeClient(state: State) {
  const reads: string[] = []
  const writes: Array<{ sql: string; values: unknown[] }> = []
  const $queryRaw = vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?')
    reads.push(sql)
    if (sql.includes('IS DISTINCT FROM')) return [{ n: BigInt(state.elsewhere) }]
    return [{ forged: BigInt(state.forged), with_charts: BigInt(state.withCharts) }]
  })
  const $executeRaw = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    writes.push({ sql: strings.join('?'), values })
    const changed = state.withCharts
    if (!state.updateDoesNothing) state.withCharts = 0
    return changed
  })
  const $disconnect = vi.fn(async () => undefined)
  return {
    client: { $queryRaw, $executeRaw, $disconnect } as unknown as ScrubClient,
    reads,
    writes,
    $queryRaw,
    $executeRaw,
    $disconnect,
  }
}

async function exec(argv: string[], env: Record<string, string | undefined>, state: State) {
  const fake = fakeClient(state)
  const makeClient = vi.fn(() => fake.client)
  const out: string[] = []
  const err: string[] = []
  const code = await run({
    argv,
    env,
    makeClient,
    log: line => out.push(line),
    error: line => err.push(line),
  })
  return { code, out: out.join('\n'), err: err.join('\n'), makeClient, ...fake }
}

describe('scripts/scrub-forged-aura-charts.ts', () => {
  describe('dry-run is the default', () => {
    it('counts and reports, and never writes', async () => {
      const r = await exec([], { DATABASE_URL: URL }, { forged: 40, withCharts: 7, elsewhere: 2 })
      expect(r.code).toBe(0)
      expect(r.$executeRaw).not.toHaveBeenCalled()
      expect(r.out).toContain('dry-run')
      expect(r.out).toContain('aura.sourceCharts present: 7')
      expect(r.out).toContain('Forged vessels')
      expect(r.out).toContain('7 row(s) would be scrubbed')
      expect(r.out).toContain('OUTSIDE that predicate')
      expect(r.out).toContain('(left alone): 2')
    })

    it('says so when there is nothing to scrub', async () => {
      const r = await exec([], { DATABASE_URL: URL }, { forged: 40, withCharts: 0, elsewhere: 0 })
      expect(r.code).toBe(0)
      expect(r.out).toContain('nothing to scrub')
      expect(r.$executeRaw).not.toHaveBeenCalled()
    })
  })

  describe('--apply', () => {
    it('removes aura.sourceCharts from the forged rows and verifies it', async () => {
      const state = { forged: 40, withCharts: 7, elsewhere: 2 }
      const r = await exec(['--apply'], { DATABASE_URL: URL }, state)
      expect(r.code).toBe(0)
      expect(r.$executeRaw).toHaveBeenCalledOnce()
      expect(r.out).toContain('APPLY')
      expect(r.out).toContain('Scrubbed 7 row(s)')
      expect(r.out).toContain('Remaining with aura.sourceCharts: 0')
    })

    it('touches only forged rows and only the sourceCharts key', async () => {
      const r = await exec(
        ['--apply'],
        { DATABASE_URL: URL },
        { forged: 4, withCharts: 4, elsewhere: 9 }
      )
      const [write] = r.writes
      expect(write.values).toEqual(['philosopher-stone-user'])
      expect(write.sql).toMatch(/UPDATE "historical_agents"/)
      expect(write.sql).toMatch(/SET "aura" = "aura" - 'sourceCharts'/)
      expect(write.sql).toMatch(/WHERE "craftedBy" = \?/)
      expect(write.sql).toMatch(/jsonb_exists\("aura", 'sourceCharts'\)/)
      expect(write.sql).not.toMatch(/natalChart/)
      // every read is scoped by the same predicate (or reports the complement, read-only)
      expect(r.reads.some(sql => sql.includes('"craftedBy" = ?'))).toBe(true)
    })

    it('does nothing when no row carries the key', async () => {
      const r = await exec(
        ['--apply'],
        { DATABASE_URL: URL },
        { forged: 4, withCharts: 0, elsewhere: 0 }
      )
      expect(r.code).toBe(0)
      expect(r.$executeRaw).not.toHaveBeenCalled()
      expect(r.out).toContain('Nothing to scrub')
    })

    it('is idempotent: a second run finds nothing and writes nothing', async () => {
      const state = { forged: 4, withCharts: 3, elsewhere: 0 }
      await exec(['--apply'], { DATABASE_URL: URL }, state)
      const again = await exec(['--apply'], { DATABASE_URL: URL }, state)
      expect(again.$executeRaw).not.toHaveBeenCalled()
      expect(again.code).toBe(0)
    })

    it('fails loudly if the rows still carry the key after the update', async () => {
      const r = await exec(
        ['--apply'],
        { DATABASE_URL: URL },
        { forged: 4, withCharts: 3, elsewhere: 0, updateDoesNothing: true }
      )
      expect(r.code).toBe(1)
      expect(r.err).toContain('still carry aura.sourceCharts')
    })
  })

  describe('refuses to guess the database', () => {
    it.each([undefined, '', '   '])('exit 2 and no client when DATABASE_URL is %j', async value => {
      const r = await exec(
        ['--apply'],
        { DATABASE_URL: value, DIRECT_URL: URL },
        { forged: 1, withCharts: 1, elsewhere: 0 }
      )
      expect(r.code).toBe(2)
      expect(r.err).toContain('DATABASE_URL is not set')
      expect(r.makeClient).not.toHaveBeenCalled()
      expect(r.$queryRaw).not.toHaveBeenCalled()
      expect(r.$executeRaw).not.toHaveBeenCalled()
    })

    it('rejects an option it does not know rather than treating it as a dry-run', async () => {
      const r = await exec(
        ['--aply'],
        { DATABASE_URL: URL },
        { forged: 1, withCharts: 1, elsewhere: 0 }
      )
      expect(r.code).toBe(2)
      expect(r.err).toContain('--aply')
      expect(r.makeClient).not.toHaveBeenCalled()
    })

    it('--help prints usage and does not connect', async () => {
      const r = await exec(['--help'], {}, { forged: 0, withCharts: 0, elsewhere: 0 })
      expect(r.code).toBe(0)
      expect(r.out).toContain('Usage:')
      expect(r.makeClient).not.toHaveBeenCalled()
    })
  })

  it('never prints the credentials, only host and database', async () => {
    const r = await exec(
      ['--apply'],
      { DATABASE_URL: URL },
      { forged: 4, withCharts: 1, elsewhere: 0 }
    )
    const everything = `${r.out}\n${r.err}`
    expect(everything).toContain('db.example.test:5432/prod')
    expect(everything).not.toContain('hunter2')
    expect(everything).not.toContain('app_user')
    expect(everything).not.toContain('sslmode')
  })

  it('always disconnects, even when a query throws', async () => {
    const fake = fakeClient({ forged: 1, withCharts: 1, elsewhere: 0 })
    fake.$queryRaw.mockRejectedValueOnce(new Error('connection reset'))
    await expect(
      run({
        argv: [],
        env: { DATABASE_URL: URL },
        makeClient: () => fake.client,
        log: () => {},
        error: () => {},
      })
    ).rejects.toThrow('connection reset')
    expect(fake.$disconnect).toHaveBeenCalledOnce()
  })

  describe('helpers', () => {
    it('parseArgs: dry-run unless --apply is given exactly', () => {
      expect(parseArgs([])).toEqual({ apply: false, help: false, unknown: [] })
      expect(parseArgs(['--apply'])).toEqual({ apply: true, help: false, unknown: [] })
      expect(parseArgs(['--apply=false']).apply).toBe(false)
      expect(parseArgs(['--apply=false']).unknown).toEqual(['--apply=false'])
      expect(parseArgs(['-h']).help).toBe(true)
    })

    it('describeTarget drops user, password and query', () => {
      expect(describeTarget(URL)).toBe('db.example.test:5432/prod')
      expect(describeTarget('not a url')).toBe('(unparseable connection string)')
    })

    it('refusalReason is null only when DATABASE_URL is set', () => {
      expect(refusalReason({ DATABASE_URL: URL })).toBeNull()
      expect(refusalReason({})).toMatch(/DATABASE_URL/)
      expect(refusalReason({ DATABASE_URL: ' ' })).toMatch(/DATABASE_URL/)
    })
  })
})
