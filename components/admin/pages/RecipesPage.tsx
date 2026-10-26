'use client'

import type { ReactNode } from 'react'
import { RecipeLatencyReportSchema, type RecipeLatencyPayload } from '@/lib/admin/page-schemas'
import {
  RecipeActivityReportSchema,
  type RecipeActivityPayload,
} from '@/lib/admin/recipe-activity-schema'
import { cn } from '@/lib/utils'
import { AdminFrame } from './AdminFrame'
import {
  AlertList,
  Badge,
  Card,
  LoadState,
  Read,
  ScrollTable,
  SourceNotice,
  formatAgo,
  formatDuration,
  num,
  td,
  th,
  useValidatedPoll,
} from './primitives'

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-950/60 p-3">
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-zinc-50">{children}</dd>
      {note && <p className="mt-0.5 text-[11px] text-zinc-400">{note}</p>}
    </div>
  )
}

export function RecipeActivityView({ data }: { data: RecipeActivityPayload }) {
  return (
    <>
      <AlertList alerts={data.alerts} />
      <Card
        title="Catalog coverage"
        subtitle="The bundled recipe snapshot available to agents in this deployment. Metadata completeness does not verify recipe quality or dietary safety."
      >
        <Read section={data.catalog}>
          {catalog => (
            <>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Catalog recipes"
                  note={`${catalog.ingredientLines.toLocaleString('en-US')} ingredient lines · ${catalog.instructionSteps.toLocaleString('en-US')} instruction steps`}
                >
                  {catalog.recipes.toLocaleString('en-US')}
                </Stat>
                <Stat label="Cuisine / meal tags" note={`of ${catalog.recipes} recipes`}>
                  {catalog.withCuisine.toLocaleString('en-US')} /{' '}
                  {catalog.withMealType.toLocaleString('en-US')}
                </Stat>
                <Stat label="Elemental metadata" note={`of ${catalog.recipes} recipes`}>
                  {catalog.withElements.toLocaleString('en-US')}
                </Stat>
                <Stat label="Nutrition metadata" note={`of ${catalog.recipes} recipes`}>
                  {catalog.withNutrition.toLocaleString('en-US')}
                </Stat>
              </dl>
              {catalog.cuisines.length > 0 && (
                <p className="mt-3 break-words text-xs text-zinc-300">
                  <span className="text-zinc-400">Largest cuisine groups: </span>
                  {catalog.cuisines
                    .slice(0, 8)
                    .map(cuisine => `${cuisine.name} (${cuisine.recipes})`)
                    .join(' · ')}
                </p>
              )}
              <p className="mt-3 text-[11px] text-zinc-400">
                Loaded through the catalog validator: unique IDs, names, ingredients and
                instructions are required. This snapshot does not measure the live WTEN catalog.
              </p>
            </>
          )}
        </Read>
      </Card>

      <Card
        title="Agent recipe activity · 7 days"
        subtitle={`Local agent_action_events created since ${new Date(data.windowStart).toLocaleString()}. Only recipe_alteration and catalog_review sources are counted.`}
      >
        <Read section={data.activity7d}>
          {activity => (
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Recorded events">{activity.events.toLocaleString('en-US')}</Stat>
              <Stat label="Recipe alterations">{activity.alterations.toLocaleString('en-US')}</Stat>
              <Stat label="Catalog reviews">{activity.catalogReviews.toLocaleString('en-US')}</Stat>
              <Stat label="Feed acknowledged">
                {activity.feedAcknowledged.toLocaleString('en-US')}
              </Stat>
              <Stat label="Feed not acknowledged">
                {activity.feedUnacknowledged.toLocaleString('en-US')}
              </Stat>
              <Stat label="Feed acknowledgement unknown">
                {activity.feedUnknown.toLocaleString('en-US')}
              </Stat>
            </dl>
          )}
        </Read>
        <p className="mt-3 text-[11px] text-zinc-400">
          Feed acknowledgement is the recorded feedPublished boolean. False can include delivery
          being disabled; absent values are unknown. Local status does not confirm publication.
          Recipe comment delivery is not recorded here and remains unknown.
        </p>
      </Card>

      <Card
        title="Recent recipe activity"
        subtitle="Latest 20 local records in the same 7-day window; attempts without a saved event are not visible."
      >
        <Read section={data.recent}>
          {rows =>
            rows.length === 0 ? (
              <p className="text-sm text-zinc-300">
                No recorded recipe activity in the last 7 days.
              </p>
            ) : (
              <ScrollTable label="Recent agent recipe activity">
                <thead>
                  <tr>
                    <th className={th}>Created</th>
                    <th className={th}>Agent</th>
                    <th className={th}>Recipe / source</th>
                    <th className={th}>Substitutions</th>
                    <th className={th}>Instruction review</th>
                    <th className={th}>Local status</th>
                    <th className={th}>Feed acknowledgement</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td className={td} title={new Date(row.createdAt).toLocaleString()}>
                        {formatAgo(row.createdAt)}
                      </td>
                      <td className={cn(td, 'font-mono')}>{row.agentId}</td>
                      <td className={td}>
                        <span>{row.recipeName ?? row.recipeId ?? 'Recipe not recorded'}</span>
                        <span className="block text-[11px] text-zinc-400">
                          {row.source === 'recipe_alteration' ? 'Alteration' : 'Catalog review'}
                        </span>
                      </td>
                      <td className={td}>
                        {num(row.substitutions, 'Substitutions were not recorded for this event.')}
                      </td>
                      <td className={td}>
                        {row.instructionReviewRequired === true
                          ? 'Required'
                          : row.instructionReviewRequired === false
                            ? 'Not flagged'
                            : 'Not recorded'}
                      </td>
                      <td className={td}>{row.status}</td>
                      <td className={td}>
                        <Badge
                          glyph={row.feedPublished === true ? '✓' : '○'}
                          label={
                            row.feedPublished === true
                              ? 'Acknowledged'
                              : row.feedPublished === false
                                ? 'Not acknowledged'
                                : 'Unknown'
                          }
                          tone={row.feedPublished === true ? 'ok' : 'muted'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ScrollTable>
            )
          }
        </Read>
      </Card>
    </>
  )
}

/** p95 against WTEN's 45s budget: a thin bar starting at zero. */
function BudgetMeter({
  p95,
  budget,
  reason,
}: {
  p95: number | null
  budget: number
  reason: string
}) {
  const share = p95 === null ? 0 : Math.min(1, p95 / budget)
  return (
    <div>
      <div className="flex justify-between text-[11px] text-zinc-400">
        <span>p95 {num(p95, reason, formatDuration)}</span>
        <span>WTEN budget {formatDuration(budget)}</span>
      </div>
      <div
        className="mt-1 h-1.5 rounded-full bg-white/10"
        role="meter"
        aria-label="p95 generation time against WTEN's prewarm budget"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={p95 ?? undefined}
      >
        {p95 !== null && (
          <div
            className={cn(
              'h-1.5 rounded-full',
              share >= 1 ? 'bg-rose-400' : share > 0.7 ? 'bg-amber-400' : 'bg-sky-400'
            )}
            style={{ width: `${Math.max(2, share * 100)}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function RecipesView({ data }: { data: RecipeLatencyPayload }) {
  const s = data.summary
  const reason =
    data.source.status === 'live'
      ? 'No generations in the window.'
      : `Latency source ${data.source.status.replace('_', ' ')}: ${data.source.reason}`
  const providers = s ? Object.entries(s.byProvider).sort((a, b) => b[1].count - a[1].count) : []
  return (
    <>
      <AlertList alerts={data.alerts} />
      <SourceNotice status={data.source} />
      <Card
        title="/api/generate-recipe"
        subtitle={
          s ? (
            <>
              Counted by the Python backend since {formatAgo(s.countingSince)} (process start{' '}
              {new Date(s.processStartedAt).toLocaleString()}); resets on each deploy. Cache hits
              are excluded from latency.
            </>
          ) : (
            'The Python backend keeps an in-process window of generation times.'
          )
        }
      >
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="p50">{num(s?.p50Ms, reason, formatDuration)}</Stat>
          <Stat label="p95">{num(s?.p95Ms, reason, formatDuration)}</Stat>
          <Stat
            label="Error rate"
            note={s ? `${s.errors} of ${s.generated + s.errors} generations` : undefined}
          >
            {num(
              s?.errorRate,
              s ? 'No generation attempts in the window.' : reason,
              v => `${(v * 100).toFixed(1)}%`
            )}
          </Stat>
          <Stat label="Generated / cache hits">
            {s ? (
              <span>
                {s.generated.toLocaleString('en-US')} / {s.cacheHits.toLocaleString('en-US')}
              </span>
            ) : (
              num(null, reason)
            )}
          </Stat>
        </dl>
        <div className="mt-4">
          <BudgetMeter p95={s?.p95Ms ?? null} budget={data.wtenBudgetMs} reason={reason} />
        </div>
      </Card>

      <Card
        title="By provider"
        subtitle="Which model in the fallback chain produced each recipe, and how long it took."
      >
        {providers.length === 0 ? (
          <p className="text-sm text-zinc-300">
            {s ? 'No generations in the window.' : num(null, reason)}
          </p>
        ) : (
          <ScrollTable label="Recipe generation by provider">
            <thead>
              <tr>
                <th className={th}>Provider</th>
                <th className={th}>Recipes</th>
                <th className={th}>p50</th>
                <th className={th}>p95</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(([name, p]) => (
                <tr key={name}>
                  <td className={cn(td, 'font-mono')}>{name}</td>
                  <td className={td}>{p.count}</td>
                  <td className={td}>{num(p.p50Ms, 'No samples', formatDuration)}</td>
                  <td className={td}>{num(p.p95Ms, 'No samples', formatDuration)}</td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        )}
        <p className="mt-3 text-[11px] text-zinc-400">
          Not measured yet: how often each provider in the chain is tried and skipped (fallback
          rate). The backend logs <code className="text-zinc-300">fallback_event</code> lines but
          does not count them anywhere this page can read.
        </p>
      </Card>
    </>
  )
}

export function RecipesPage() {
  const activity = useValidatedPoll(
    '/api/admin/recipe-activity',
    RecipeActivityReportSchema,
    60_000
  )
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/recipe-latency',
    RecipeLatencyReportSchema,
    60_000
  )
  const data =
    loaded.state === 'ok' ? loaded.data : loaded.state === 'error' ? loaded.stale : undefined
  const activityData =
    activity.loaded.state === 'ok'
      ? activity.loaded.data
      : activity.loaded.state === 'error'
        ? activity.loaded.stale
        : undefined
  return (
    <AdminFrame
      title="Recipes & agent activity"
      description="Catalog coverage, persisted agent alterations and reviews, and generation latency against WTEN's 45-second prewarm budget."
      updated={
        activityData
          ? `Activity read ${formatAgo(activityData.generatedAt)}${data ? ` · Latency read ${formatAgo(data.generatedAt)}` : ''}`
          : data
            ? `Latency read ${formatAgo(data.generatedAt)}`
            : undefined
      }
    >
      <LoadState loaded={activity.loaded} onRetry={activity.refresh} />
      {activityData && <RecipeActivityView data={activityData} />}
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <RecipesView data={data} />}
    </AdminFrame>
  )
}
