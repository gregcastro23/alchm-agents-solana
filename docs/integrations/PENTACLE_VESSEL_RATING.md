# Pentacle Vessel Rating

ASOL is the single source of truth for how a Pentacles vessel is rated. The game
(`pentacles`) and the Next.js UI read one payload from `GET /api/agents/rating`; feeders push
live ESMS holdings with `POST`. All maths lives in `lib/agents/rating/` and is pure unless
noted.

```
Sacred 7 stats ──► rateStats ──────────────► ovr · ratings · relativeAdvantage · archetype
stats + ESMS holdings + natal chart ──────► evaluateSeals ──► seals
live sky (+ Monica, + natal chart) ───────► calculateResonanceSurge ──► surge
stats + seals + surge ────────────────────► computeZoneSynergies ──► zoneSynergies · bestZoneId
agent id ─────────────────────────────────► vessel-appearance registry ──► appearance
```

## The scale

The **Pentacle Vessel Rating Scale** runs 25–99. Each Sacred 7 stat (0–100) maps linearly onto
it; **OVR** is an ordered weighted average of the seven ratings (the weights follow rank, not a
fixed stat, so OVR is monotone). `archetype` is `{ title, primary, secondary }`, named from each
stat's advantage over a pinned roster baseline (`STAT_BASELINES`), not from raw height — raw
height named most of the roster after `power`, which `deriveStatsFromChart` weights far above
the rest. `deriveStatsFromChart` itself is untouched, so persona prompts and their Anthropic
cache keys do not move.

## Alchemical Seals

Seven Seals, one per Sacred 7 stat, each tied to an ESMS token:

| Seal                 | Stat         | Token     |
| -------------------- | ------------ | --------- |
| Crucible Finisher    | power        | substance |
| Astral Vision        | intuition    | spirit    |
| Immovable Foundation | vitality     | matter    |
| Harmonic Sovereign   | charisma     | essence   |
| Tidal Chorus         | resonance    | essence   |
| Quicksilver Pivot    | adaptability | spirit    |
| Philosopher's Stone  | wisdom       | matter    |

Tiers: **Copper < Silver < Gold < Aether < Celestial**. A tier needs both gates:

| Tier      | Rating (aligned) | ESMS balance (whole tokens) |
| --------- | ---------------- | --------------------------- |
| Copper    | 74               | 0.5                         |
| Silver    | 80               | 2                           |
| Gold      | 86               | 10                          |
| Aether    | 91               | 50                          |
| Celestial | 96               | 250                         |

Celestial also needs at least 4 of the 10 classical bodies natally in the token's element.
`placeholder` and `unattributed` natal charts count as no chart.

**Mean alignment.** The rating gates are compared with an _aligned_ rating,
`rating − rating(league mean of the stat) + rating(common mean)` (a stat-point difference of
`d` is `0.74·d` rating points), so a gate means the same distance above "typical" for every stat.
Without it `power`'s +8.5 baseline inflation gave Crucible Finisher more than twice the award
rate of the others. Ratings and OVR stay on the raw scale; each Seal reports its `alignedRating`.

**`maxTier`.** A pure shift lowers the ceiling of `power`: a perfect stat aligns to 93.5, short of
Celestial's 96. Crucible Finisher therefore tops out at **Aether** (`maxTier: "Aether"`,
`nextTier: null` once reached); the other six Seals reach Celestial. The alternative, an anchored
map that preserves every stat's ceiling, is a one-line change in `computeMeanAlignedRating`; it
departs from the literal `rating − mean + GLOBAL_ROSTER_MEAN` and is a product decision.

## Resonance Surge

`heat` and `reactivity` come from the canonical `Thermodynamics` payload
(`lib/thermodynamics/kalchm.ts`; nothing is re-derived here) and ramp between sky-measured
anchors (`DEFAULT_SURGE_CALIBRATION`, pinned by `test/agents/surge-calibration.spec.ts`) into a
0–100 meter. An optional natal chart plus the live sky adds a bounded elemental-harmony offset
of −12…+12. The surge is **active at ≥ 70**; boosts apply only while active.

- `inferno` — heat-led: boosts resonance and charisma.
- `tempest` — reactivity-led: boosts intuition and adaptability.
- `equilibrium` — active **and** Monica exactly `MONICA_EQUILIBRIUM` (1.618): the union of both.

`monicaState` is `absent` (Monica `null`), `equilibrium`, `convergent` (> 0) or `divergent` (< 0).
Monica never enters the meter: it is signed and unbounded, and `calculateMonica` documents why no
near-equilibrium band can be derived.

## The live sky

`lib/agents/rating/live-sky.ts` takes positions from the **planetary-agents backend**
(`agentRequest('/planetary/current')`) only when the payload is stamped
`source: "swiss-ephemeris"`; otherwise from the local Keplerian approximation, whose
`vsop87-approximation` label is carried into the result (`payload.sky.source`). A partial sky
(fewer than ten bodies) is never used. If neither source yields all ten, `surge` is `null` and
`degraded.sky` says why — a missing sky never looks like a calm one. The WTEN host answers the
same path with a different stamp (`pyswisseph`) that the parser refuses by design.

## ESMS holdings and whose wallet a GET may show

`esmsSource` is `spacetimedb` (a live push), `database` (the `token_balances` ledger) or
`fallback` (a deterministic baseline, always with `degraded.esms`). A failed read is never
presented as a healthy zero.

A roster agent's wallet belongs to an _agentic_ user and is public. A vessel **a person forged**
reads that person's `token_balances` row, and a person's balance is private — the app's own
`/api/economy/balances` is session-gated, while this route is unauthenticated with CORS `*` and
the gallery lists every forged vessel id. So:

- an anonymous `GET` never reads a creator's wallet: it answers the baseline,
  `esmsSource: "fallback"`, `degraded.esms: "owner wallet is private"`, and the Seals are computed
  from that baseline, so a tier cannot leak the balance either;
- the wallet is read only for a server caller sending `Authorization: Bearer $INTERNAL_API_SECRET`,
  or a signed-in session whose user **is** the creator. A cross-origin browser sends neither
  (`*` forbids credentialed requests; `Authorization` fails the preflight);
- pushed holdings for a forged vessel are likewise shown only to the secret holder.

`degraded.esms` is a fixed vocabulary — `ledger unavailable`, `ledger row invalid`,
`no ledger row`, `owner wallet is private`, `spacetimedb holdings rejected`,
`baseline unavailable` — never a driver message, code or value. The detail goes to the server log.

The Prisma store is `lib/agents/rating/esms-ledger-store.server.ts` (`import 'server-only'`).
`esms-balance-resolver.ts` and the barrel are isomorphic and must not reach `@/lib/db`, even
through a guarded dynamic import: Next compiles a client component's graph in the SSR layer too,
where the guard folds away and `lib/db.ts` fails the build. `test/agents/rating-client-safe.spec.ts`
walks the graph.

## Endpoints

### `GET /api/agents/rating?agentId=<id>`

`id` is 1–100 of letters, digits, `.` `_` `-`. Roster ids are slug-tolerant; `user-avatar-neo` is
Pentacles' default avatar and resolves to the roster agent `greg-castro-1991` for its stats, chart
and wallet (the look is hand-authored under the avatar id). Other ids are looked up as a
user-forged `historical_agents` row, in either natal-chart shape the app writes (the roster
`{ planets }` shape and the forge's `tropical.CelestialBodies`), and rated from persisted Sacred 7
columns when present, else from the chart (ascendant included, so the same chart rates the same).

Response fields: `agentId, name, scale, ovr, ratings, spread, relativeAdvantage, archetype,
esmsBalances, esmsSource, seals[], surge | null, appearance, zoneSynergies[], bestZoneId, sky | null`
and, only when something was read in a degraded way, `degraded: { esms?, sky? }`.

Statuses: `400` bad id, `404` unknown, `422` known but unratable, `429` (per-caller 120/min,
shared 1200/min; `RATING_API_PER_CALLER_PER_MIN`, `RATING_API_GLOBAL_PER_MIN`), `503` lookup
unavailable, `500` opaque. Always `Cache-Control: no-store`; CORS `*` for `GET`/`OPTIONS`.

### `GET /api/agents/rating?roster=true`

A light summary of every historical agent (`ovr`, `archetype`, `era`, `crownStyle`,
`signatureRelic`); reads neither the ledger nor the sky. `Cache-Control: public, max-age=300`.

### `POST /api/agents/rating` (internal)

`Authorization: Bearer $INTERNAL_API_SECRET` (compared in constant time; `503` when unset, `401`
when wrong; no CORS). Body (≤ 4 KiB, enforced on bytes read, not on `Content-Length`):
`{ agentId, esmsBalances: { spirit, essence, matter, substance } }`, finite and non-negative.
Returns the recalculated payload. **It never writes the ledger**: ESMS balances are ledger-backed
and deliberately not editable from a request. A pushed holding is live SpacetimeDB state — used for
the recalculation and kept for 60 s per serverless instance, keyed by the ledger id, so a following
`GET` sees it (`esmsSource: "spacetimedb"`).

## Zone contests

`lib/agents/rating/pentacle-contest.ts`: eleven zones (Houses 0–4, Spires 5–9, Crown 10), each
with Sacred 7 weights and an ESMS element. `resolveZoneContest(attacker, defender, zoneId,
currentControl)` scores zone-weighted stats with the active surge's boosts and a per-token Seal
multiplier (Copper 1.05, Silver 1.10, Gold 1.18, Aether 1.28, Celestial 1.40).

## Known limits

- Rate limits and the pushed cache are per serverless instance (best effort), and
  `getClientIp` trusts the first `x-forwarded-for` token — a platform that does not overwrite it
  lets one client rotate its bucket.
- A forged vessel's chart has no provenance label (the app's calculator is a Keplerian
  approximation), so it can count toward Celestial.
- The ESMS gates (0.5 / 2 / 10 / 50 / 250) are policy, not measurement; the stat gates and the
  surge anchors are measured.
- The forged-vessel lookup and the ledger reads are covered with fakes, not against Postgres.

## Files

| Concern                | File                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| OVR, archetype         | `lib/agents/rating/ovr-archetype.ts`                                        |
| Seals, Resonance Surge | `lib/agents/rating/seals-surge.ts`                                          |
| Live sky               | `lib/agents/rating/live-sky.ts`, `lib/spacetime/derive-live-ephemeris.ts`   |
| Appearance registry    | `lib/agents/rating/vessel-appearance.ts`                                    |
| ESMS holdings          | `lib/agents/rating/esms-balance-resolver.ts`, `esms-ledger-store.server.ts` |
| Zone contests          | `lib/agents/rating/pentacle-contest.ts`                                     |
| Payload assembly       | `lib/agents/rating/vessel-payload.ts`                                       |
| Route                  | `app/api/agents/rating/route.ts`                                            |
