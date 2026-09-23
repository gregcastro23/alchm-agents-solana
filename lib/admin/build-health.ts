import 'server-only'

import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'

/**
 * Build health, read live from GitHub: the latest CI run of every workflow on
 * main, the open pull requests with their CI state, and how far the running
 * deployment is behind main. The static code census stays on the codebase
 * manifest (`/api/admin/codebase-health`), which reports its own age.
 *
 * The repo is public, so this works without a token; `GITHUB_TOKEN` (read-only
 * is enough) raises the rate limit from 60 to 5,000 requests an hour. Results
 * are cached for five minutes per instance.
 */

export const DEFAULT_REPO = 'gregcastro23/alchm-agents-solana'
const CACHE_MS = 5 * 60_000
const TIMEOUT_MS = 8_000
/** A deployment this many commits behind main is worth a note. */
export const BEHIND_NOTE_COMMITS = 10

export type CiState = 'success' | 'failure' | 'pending' | 'cancelled' | 'none'

export interface WorkflowRun {
  workflow: string
  state: CiState
  sha: string
  url: string
  startedAt: string
  durationMs: number | null
}

export interface PullSummary {
  number: number
  title: string
  draft: boolean
  author: string
  head: string
  updatedAt: string
  url: string
  ci: CiState
}

export interface BuildHealthReport {
  generatedAt: string
  repo: string
  authenticated: boolean
  deployed: { sha: string | null; ref: string | null; env: string | null }
  main: Section<{ sha: string; message: string; committedAt: string; url: string }>
  behind: Section<{ commits: number }>
  ci: Section<WorkflowRun[]>
  pulls: Section<PullSummary[]>
  alerts: AdminAlert[]
}

type Fetcher = (path: string) => Promise<unknown>

interface RawRun {
  name: string
  status: string
  conclusion: string | null
  head_sha: string
  html_url: string
  run_started_at?: string
  created_at: string
  updated_at: string
}

export function runState(run: Pick<RawRun, 'status' | 'conclusion'>): CiState {
  if (run.status !== 'completed') return 'pending'
  if (run.conclusion === 'success' || run.conclusion === 'skipped' || run.conclusion === 'neutral')
    return 'success'
  if (run.conclusion === 'cancelled') return 'cancelled'
  return 'failure'
}

/** Worst state across a commit's runs: any failure fails it, then pending. */
export function combine(states: CiState[]): CiState {
  if (states.length === 0) return 'none'
  for (const s of ['failure', 'pending', 'cancelled'] as const) if (states.includes(s)) return s
  return 'success'
}

/** The latest run of each workflow; GitHub returns runs newest first. */
export function latestPerWorkflow(runs: RawRun[]): WorkflowRun[] {
  const seen = new Map<string, WorkflowRun>()
  for (const run of runs) {
    if (seen.has(run.name)) continue
    const started = run.run_started_at ?? run.created_at
    seen.set(run.name, {
      workflow: run.name,
      state: runState(run),
      sha: run.head_sha,
      url: run.html_url,
      startedAt: started,
      durationMs:
        run.status === 'completed' ? Date.parse(run.updated_at) - Date.parse(started) : null,
    })
  }
  return [...seen.values()].sort((a, b) => a.workflow.localeCompare(b.workflow))
}

export function buildAlerts(r: Omit<BuildHealthReport, 'alerts'>): AdminAlert[] {
  const alerts: AdminAlert[] = []
  const unread = (['main', 'ci', 'pulls'] as const).filter(k => !r[k].ok)
  if (unread.length > 0) {
    alerts.push({
      id: 'build:github-unreadable',
      severity: 'info',
      source: 'codebase',
      title: `Could not read ${unread.join(', ')} from GitHub`,
      detail: unread.map(k => `${k}: ${(r[k] as { reason: string }).reason}`).join(' · '),
      remediation: r.authenticated ? undefined : 'Set GITHUB_TOKEN to raise the API rate limit.',
      href: '/admin/build',
    })
  }
  if (r.ci.ok) {
    const failing = r.ci.value.filter(run => run.state === 'failure')
    if (failing.length > 0) {
      alerts.push({
        id: 'build:main-ci-failing',
        severity: 'warning',
        source: 'codebase',
        title: `CI is failing on main: ${failing.map(f => f.workflow).join(', ')}`,
        detail: failing.map(f => `${f.workflow} at ${f.sha.slice(0, 7)}`).join('; '),
        href: failing[0].url,
      })
    }
  }
  if (r.behind.ok && r.behind.value.commits >= BEHIND_NOTE_COMMITS) {
    alerts.push({
      id: 'build:deploy-behind-main',
      severity: 'info',
      source: 'codebase',
      title: `This deployment is ${r.behind.value.commits} commits behind main`,
      detail: `Running ${r.deployed.sha?.slice(0, 7)} (${r.deployed.env ?? 'unknown env'}).`,
      href: '/admin/build',
    })
  }
  return alerts
}

export async function buildBuildHealthReport(
  get: Fetcher,
  env: {
    repo: string
    authenticated: boolean
    sha: string | null
    ref: string | null
    vercelEnv: string | null
  },
  now: Date = new Date()
): Promise<BuildHealthReport> {
  const base = `/repos/${env.repo}`
  const [main, ci, pulls, behind] = await Promise.all([
    readSection(async () => {
      const c = (await get(`${base}/commits/main`)) as {
        sha: string
        html_url: string
        commit: { message: string; committer: { date: string } }
      }
      return {
        sha: c.sha,
        message: c.commit.message.split('\n')[0].slice(0, 200),
        committedAt: c.commit.committer.date,
        url: c.html_url,
      }
    }),
    readSection(async () => {
      const body = (await get(
        `${base}/actions/runs?branch=main&event=push&per_page=40&exclude_pull_requests=true`
      )) as { workflow_runs: RawRun[] }
      return latestPerWorkflow(body.workflow_runs)
    }),
    readSection(async () => {
      const [prs, runs] = (await Promise.all([
        get(`${base}/pulls?state=open&per_page=30&sort=updated&direction=desc`),
        get(`${base}/actions/runs?event=pull_request&per_page=100`),
      ])) as [
        Array<{
          number: number
          title: string
          draft: boolean
          user: { login: string } | null
          head: { ref: string; sha: string }
          updated_at: string
          html_url: string
        }>,
        { workflow_runs: RawRun[] },
      ]
      // One state per workflow at the PR's head commit, then the worst of those.
      const byHead = new Map<string, Map<string, CiState>>()
      for (const run of runs.workflow_runs) {
        const perWorkflow = byHead.get(run.head_sha) ?? new Map<string, CiState>()
        if (!perWorkflow.has(run.name)) perWorkflow.set(run.name, runState(run))
        byHead.set(run.head_sha, perWorkflow)
      }
      return prs.map(pr => ({
        number: pr.number,
        title: pr.title.slice(0, 200),
        draft: pr.draft,
        author: pr.user?.login ?? 'unknown',
        head: pr.head.ref,
        updatedAt: pr.updated_at,
        url: pr.html_url,
        ci: combine([...(byHead.get(pr.head.sha)?.values() ?? [])]),
      }))
    }),
    readSection(async () => {
      if (!env.sha) throw new Error('no VERCEL_GIT_COMMIT_SHA: not running on a Vercel deployment')
      const cmp = (await get(`${base}/compare/${env.sha}...main`)) as { ahead_by: number }
      return { commits: cmp.ahead_by }
    }),
  ])
  const report: Omit<BuildHealthReport, 'alerts'> = {
    generatedAt: now.toISOString(),
    repo: env.repo,
    authenticated: env.authenticated,
    deployed: { sha: env.sha, ref: env.ref, env: env.vercelEnv },
    main,
    behind,
    ci,
    pulls,
  }
  return { ...report, alerts: buildAlerts(report) }
}

export function githubFetcher(token: string | undefined): Fetcher {
  return async path => {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'alchm-agents-admin',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit reached')
      }
      throw new Error(`GitHub ${res.status} for ${path.split('?')[0]}`)
    }
    return res.json()
  }
}

let cached: { at: number; report: BuildHealthReport } | null = null

export async function loadBuildHealthReport(): Promise<BuildHealthReport> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report
  const token = process.env.GITHUB_TOKEN || undefined
  const report = await buildBuildHealthReport(githubFetcher(token), {
    repo: process.env.ADMIN_GITHUB_REPO || DEFAULT_REPO,
    authenticated: Boolean(token),
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  })
  // Don't pin a fully failed read for five minutes.
  if (report.main.ok || report.ci.ok || report.pulls.ok) cached = { at: Date.now(), report }
  return report
}
