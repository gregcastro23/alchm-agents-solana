#!/usr/bin/env bun
/**
 * CLI Tooling: Solana State Reconciliation
 *
 * Usage:
 *   bun run scripts/reconciliation/reconcile-solana-state.ts [--dry-run] [--auto-heal] [--json]
 *
 * Flags:
 *   --auto-heal : Automatically heal unhealed debited claims by writing recovered txHash and status 'minted'
 *   --dry-run   : Audit only (default)
 *   --json      : Output raw JSON report
 */

import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { reconcileSolanaState } from '@/lib/solana/reconciliation'

function getPrismaClient(): PrismaClient {
  const url =
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  return new PrismaClient({
    datasourceUrl: url,
    log: ['error'],
  }).$extends(withAccelerate()) as unknown as PrismaClient
}

async function main() {
  const prisma = getPrismaClient()
  const args = process.argv.slice(2)
  const autoHeal = args.includes('--auto-heal')
  const jsonOutput = args.includes('--json')

  if (!jsonOutput) {
    console.log(
      `\n🪐 [Solana Reconciliation Engine] Starting state audit (autoHeal: ${autoHeal})...\n`
    )
  }

  const report = await reconcileSolanaState({
    prisma,
    autoHeal,
  })

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.status === 'critical' ? 1 : 0)
  }

  console.log(`Report Status: ${report.status.toUpperCase()} (at ${report.timestamp})\n`)

  console.log(`Claims Audit:`)
  console.log(`  • Total Checked : ${report.claims.totalChecked}`)
  console.log(`  • Minted        : ${report.claims.mintedCount}`)
  console.log(`  • Debited       : ${report.claims.debitedCount}`)
  console.log(`  • Pending       : ${report.claims.pendingCount}`)
  console.log(`  • Failed        : ${report.claims.failedCount}`)
  console.log(`  • Stuck (>1h)   : ${report.claims.stuckCount}`)
  console.log(
    `  • Unhealed      : ${report.claims.unhealedCount} (${report.claims.healedCount} healed)`
  )
  console.log(`  • Ghosts        : ${report.claims.ghostCount}`)

  if (report.claims.discrepancies.length > 0) {
    console.log(`\nDiscrepancies:`)
    for (const d of report.claims.discrepancies) {
      console.log(
        `  [${d.type.toUpperCase()}] Claim ${d.claimId.slice(0, 10)}... (User: ${d.userId}, Age: ${d.ageMinutes}m)`
      )
      console.log(`    → ${d.detail}`)
    }
  }

  if (report.supplies) {
    console.log(`\nToken-2022 Supplies:`)
    for (const [elem, data] of Object.entries(report.supplies)) {
      console.log(
        `  • ${elem.padEnd(10)}: On-chain=${data.onChain} | DB=${data.db} | Drift=${data.drift}`
      )
    }
  }

  console.log(`\nOutbox Inspection:`)
  console.log(`  • Pending : ${report.outbox.pendingCount}`)
  console.log(`  • Failing : ${report.outbox.failingCount}`)
  if (report.outbox.oldestPendingMinutes !== null) {
    console.log(`  • Oldest  : ${report.outbox.oldestPendingMinutes}m ago`)
  }

  if (report.alerts.length > 0) {
    console.log(`\nActive Alerts (${report.alerts.length}):`)
    for (const alert of report.alerts) {
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.title}`)
      console.log(`    Detail: ${alert.detail}`)
      if (alert.remediation) {
        console.log(`    Fix:    ${alert.remediation}`)
      }
    }
  } else {
    console.log(`\n✅ No active economic alerts detected.`)
  }

  process.exit(report.status === 'critical' ? 1 : 0)
}

main().catch(err => {
  console.error('[Solana Reconciliation Engine] Fatal error:', err)
  process.exit(1)
})
