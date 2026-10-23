'use client'

import Link from 'next/link'
import { LevelingReportSchema } from '@/lib/admin/leveling-schema'
import { Card, LoadState, Read, Stat, num, useValidatedPoll } from './primitives'

/** Independent from database health so the overview can still show catalog growth. */
export function ProgressionOverview() {
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/leveling-summary',
    LevelingReportSchema,
    60_000
  )
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  return (
    <Card
      title="Vessel progression"
      subtitle="Permanent agent growth and current rating coverage."
      action={
        <Link className="text-xs text-indigo-200 underline" href="/admin/leveling">
          Inspect progression →
        </Link>
      }
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && (
        <Read section={data.progression}>
          {({ totals }) => (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Mean Vessel Level"
                  value={num(totals.avgVesselLevel, 'No recorded experience.', value =>
                    value.toFixed(1)
                  )}
                  sub={`${totals.withExperience} agents with experience`}
                />
                <Stat
                  label="Lifetime Alchm EXP"
                  value={num(
                    totals.withExperience ? totals.totalXp : null,
                    'No agents have connected experience.'
                  )}
                  sub={`${totals.pendingExperience} agents pending experience`}
                />
                <Stat
                  label="Current ratings"
                  value={`${totals.live + totals.estimated} / ${totals.agents}`}
                  sub={`${totals.live} live · ${totals.estimated} estimated · ${totals.unavailable} unavailable`}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                Catalog training is connected where recorded. Durable live awards are pending.
                Vessel Level, Current Overall and Alchemical Seals have distinct meanings.
              </p>
            </>
          )}
        </Read>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-3 text-xs text-indigo-200">
        <Link className="underline" href="/admin/agents">
          Roster & likeness coverage →
        </Link>
        <Link className="underline" href="/admin/recipes">
          Recipe catalog & agent publishing →
        </Link>
      </div>
    </Card>
  )
}
