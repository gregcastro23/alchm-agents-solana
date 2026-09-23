'use client'

import type { ReactNode } from 'react'
import { SolanaChainReportSchema, type SolanaChainPayload } from '@/lib/admin/page-schemas'
import { cn } from '@/lib/utils'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  Read,
  ScrollTable,
  Unknown,
  formatAgo,
  td,
  th,
  useValidatedPoll,
} from './primitives'

const short = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`
const explorer = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`
const sol = (lamports: number) => (lamports / 1_000_000_000).toFixed(3)
const grouped = (raw: string | null) => (raw === null ? null : BigInt(raw).toLocaleString('en-US'))

function Address({ value }: { value: string }) {
  return (
    <a
      href={explorer(value)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-sky-300 underline-offset-2 hover:underline"
      title={value}
    >
      {short(value)}
    </a>
  )
}

function Flag({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return on ? (
    <Badge glyph="⏸" label={onLabel} tone="bad" />
  ) : (
    <Badge glyph="✓" label={offLabel} tone="ok" />
  )
}

const CHECK = {
  pass: { glyph: '✓', label: 'Pass', tone: 'ok' },
  fail: { glyph: '✕', label: 'Not yet', tone: 'bad' },
  unknown: { glyph: '—', label: 'Unknown', tone: 'muted' },
} as const

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-zinc-100">{children}</dd>
    </div>
  )
}

export function SolanaView({ data }: { data: SolanaChainPayload }) {
  const passed = data.readiness.filter(i => i.state === 'pass').length
  return (
    <>
      <AlertList alerts={data.alerts} />

      <Card
        title="Devnet → mainnet readiness"
        subtitle="Computed from deployments/*.json and live chain reads."
        action={
          <Badge
            glyph="◔"
            label={`${passed} of ${data.readiness.length} pass`}
            tone={passed === data.readiness.length ? 'ok' : 'warn'}
          />
        }
      >
        <ul className="divide-y divide-white/5">
          {data.readiness.map(item => {
            const c = CHECK[item.state]
            return (
              <li
                key={item.id}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3"
              >
                <span className="shrink-0 sm:w-28">
                  <Badge glyph={c.glyph} label={c.label} tone={c.tone} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">{item.label}</p>
                  <p className="break-words text-[11px] text-zinc-400">{item.evidence}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Program"
          subtitle={`asol_program on devnet · RPC ${data.rpc.label}${data.rpc.private ? '' : ' (public)'}`}
        >
          <Read section={data.program}>
            {p => (
              <dl className="grid grid-cols-2 gap-3">
                <KV label="Program ID">
                  <Address value={p.programId} />
                </KV>
                <KV label="Executable">
                  {p.executable ? (
                    <Badge glyph="✓" label="Yes" tone="ok" />
                  ) : (
                    <Badge glyph="✕" label="No" tone="bad" />
                  )}
                </KV>
                <KV label="Last deploy slot">
                  {p.lastDeploySlot ?? <Unknown reason="ProgramData not readable" />}
                </KV>
                <KV label="Upgrade authority">
                  {p.upgradeAuthority ? <Address value={p.upgradeAuthority} /> : 'none (immutable)'}{' '}
                  {p.authorityIsMultisigVault ? (
                    <Badge glyph="✓" label="Squads vault" tone="ok" />
                  ) : (
                    <Badge glyph="!" label="Not the multisig" tone="warn" />
                  )}
                </KV>
              </dl>
            )}
          </Read>
        </Card>

        <Card title="ProgramConfig" subtitle="Keys and global pause flags (140 bytes).">
          <Read section={data.config}>
            {c => (
              <dl className="grid grid-cols-2 gap-3">
                <KV label="Admin">
                  <Address value={c.admin} />
                </KV>
                <KV label="Attestor">
                  <Address value={c.attestor} />
                </KV>
                <KV label="Pauser">
                  <Address value={c.pauser} />
                </KV>
                <KV label="Version">{c.version}</KV>
                <KV label="Claims">
                  <Flag on={c.pauseClaims} onLabel="Paused" offLabel="Open" />
                </KV>
                <KV label="Redemptions">
                  <Flag on={c.pauseRedemptions} onLabel="Paused" offLabel="Open" />
                </KV>
              </dl>
            )}
          </Read>
        </Card>
      </div>

      <Card
        title="ESMS mints"
        subtitle="Token-2022 supply read live. Holder counts need a private RPC."
      >
        <Read section={data.mints}>
          {mints => (
            <ScrollTable label="ESMS mints">
              <thead>
                <tr>
                  <th className={th}>Mint</th>
                  <th className={th}>Address</th>
                  <th className={th}>Supply</th>
                  <th className={th}>Holders</th>
                </tr>
              </thead>
              <tbody>
                {mints.map(m => (
                  <tr key={m.address}>
                    <td className={cn(td, 'font-semibold')}>{m.symbol}</td>
                    <td className={td}>
                      <Address value={m.address} />
                    </td>
                    <td className={td}>
                      {m.supply === null ? (
                        <Unknown reason="Supply not returned" />
                      ) : (
                        m.supply.toLocaleString('en-US')
                      )}
                    </td>
                    <td className={td}>
                      {m.holders === null ? (
                        <Unknown reason={m.holdersReason ?? 'Not read'} />
                      ) : (
                        m.holders
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </Read>
      </Card>

      <Card
        title="Constellation AMM pools"
        subtitle="Virtual reserves (raw units). Positions are not transferable; the pool custodies nothing."
      >
        <Read section={data.pools}>
          {pools => (
            <ScrollTable label="AMM pools">
              <thead>
                <tr>
                  <th className={th}>Pool</th>
                  <th className={th}>Pair</th>
                  <th className={th}>Reserve A</th>
                  <th className={th}>Reserve B</th>
                  <th className={th}>Shares</th>
                  <th className={th}>State</th>
                </tr>
              </thead>
              <tbody>
                {pools.map(p => (
                  <tr key={p.poolId}>
                    <td className={td}>
                      {p.poolId} <Address value={p.address} />
                    </td>
                    <td className={td}>{p.pair}</td>
                    <td className={td}>{grouped(p.reserveA) ?? '—'}</td>
                    <td className={td}>{grouped(p.reserveB) ?? '—'}</td>
                    <td className={td}>{grouped(p.totalShares) ?? '—'}</td>
                    <td className={td}>
                      {!p.exists ? (
                        <Badge glyph="○" label="Not created" tone="muted" />
                      ) : p.paused ? (
                        <Badge glyph="⏸" label="Paused" tone="bad" />
                      ) : p.bootstrapped ? (
                        <Badge glyph="✓" label="Live" tone="ok" />
                      ) : (
                        <Badge glyph="!" label="Not bootstrapped" tone="warn" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}
        </Read>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Squads multisig"
          subtitle="Threshold and members from the governance manifest; account and vault read live."
        >
          <Read section={data.multisig}>
            {m => (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <KV label="Multisig">
                    <Address value={m.multisigPda} />{' '}
                    {m.accountExists ? (
                      <Badge glyph="✓" label="On chain" tone="ok" />
                    ) : (
                      <Badge glyph="✕" label="Missing" tone="bad" />
                    )}
                  </KV>
                  <KV label="Vault">
                    <Address value={m.vaultPda} />
                  </KV>
                  <KV label="Threshold">
                    {m.threshold} of {m.members.length}
                  </KV>
                  <KV label="Vault balance">{sol(m.vaultLamports)} SOL</KV>
                </dl>
                <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                  {m.members.map(member => (
                    <li key={member.address}>
                      <span className="text-zinc-400">{member.role}</span>{' '}
                      <Address value={member.address} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Read>
        </Card>

        <Card
          title="Deployer & workers"
          subtitle="Deployer SOL for upgrades; sync and bridge worker heartbeats and queues."
        >
          <Read section={data.deployer}>
            {d => (
              <dl className="grid grid-cols-2 gap-3">
                <KV label="Deployer">
                  <Address value={d.address} />
                </KV>
                <KV label="Balance">
                  {sol(d.lamports)} SOL{' '}
                  {d.low ? (
                    <Badge glyph="!" label={`Below ${d.lowBelowSol} SOL`} tone="warn" />
                  ) : (
                    <Badge glyph="✓" label="Funded" tone="ok" />
                  )}
                </KV>
              </dl>
            )}
          </Read>
          <div className="mt-4">
            <Read section={data.workers}>
              {w => (
                <dl className="grid grid-cols-2 gap-3">
                  {(['sync', 'bridge'] as const).map(name => (
                    <KV key={name} label={`${name} worker`}>
                      {w[name].connectionStatus === 'connected' ? (
                        <Badge glyph="✓" label="Connected" tone="ok" />
                      ) : w[name].connectionStatus === 'stopped' ? (
                        <Badge glyph="✕" label="Not reporting" tone="bad" />
                      ) : (
                        <Badge glyph="!" label={w[name].connectionStatus} tone="warn" />
                      )}
                      <span className="block text-[11px] text-zinc-400">
                        {w[name].queueDepth} queued · heartbeat {formatAgo(w[name].heartbeatAt)}
                      </span>
                    </KV>
                  ))}
                </dl>
              )}
            </Read>
          </div>
        </Card>
      </div>
    </>
  )
}

export function SolanaPage() {
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/solana',
    SolanaChainReportSchema,
    120_000
  )
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <AdminFrame
      title="Solana & chain"
      description="The asol_program on devnet, read live: program and upgrade authority, config, mints, AMM pools, the Squads multisig, the deployer, the workers, and what is left before mainnet."
      updated={data ? `Read ${formatAgo(data.generatedAt)}` : undefined}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <SolanaView data={data} />}
    </AdminFrame>
  )
}
