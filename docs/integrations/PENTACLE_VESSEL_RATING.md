# Pentacle Vessel Rating

The Pentacles rating **contract** lives in `lib/agents/rating-contract.ts` (types, tier names, gates,
multipliers, roster baselines, OVR, archetype titles, the Monica and surge functions) and the look in
`lib/agents/vessel-appearance-manifest.ts`; both were ratified in #65 and are the source of truth for
what a rating _means_. This directory, `lib/agents/rating/`, is the **server layer** that feeds the
contract live inputs — Sacred 7 stats, ESMS ledger holdings, the live sky, natal charts — and adds the
things the contract has no inputs for. `pentacles` and the Next.js UI read one payload from
`GET /api/agents/rating`; feeders push live ESMS holdings with `POST`.

```
Sacred 7 stats ──toRating──► ratings (25–99) ──► computeOvr · computeRelativeAdvantage · resolveArchetype
ratings + ESMS holdings + natal chart ────────► evaluateSealTier (+ Celestial bar) ──► seals · sealProgress
live sky (+ Monica, + natal chart, + archetype) ► ramp + harmony ► evaluateSurgeState ──► surge
ratings + seals + surge ──────────────────────► computeZoneSynergies ──► zoneSynergies · bestZoneId
agent id (+ faction, archetype) ──────────────► resolveAgentAppearance ──► appearance
```

Every box that decides a number is a call into the contract, not a copy;
`test/agents/rating-contract-parity.spec.ts` fails if a result ever differs from the contract's own
function on the same inputs.

## The scale

The **Pentacle Vessel Rating Scale** runs 25–99. A Sacred 7 stat (0–100) maps linearly onto it,
`rating = round(25 + 0.74·stat)`. The contract then gives:

- **OVR** = `(top₁·1.6 + top₂·1.3 + mean(other five)) / 3.9`, rounded — an ordered weighted average, so it
  is monotone in every stat;
- **relativeAdvantage** = rating − the contract's pinned roster baseline (63, 62, 64, 61, 62, 63, 62);
- **archetype** `{ title, primary, secondary }` from the two largest advantages, titled by the contract's
  matrix (`power` + `charisma` is "Dominant Commander").

`deriveStatsFromChart` is untouched, so persona prompts and their Anthropic cache keys do not move.

## Alchemical Seals

Seven Seals, one per Sacred 7 stat, each tied to an ESMS token (`seal-<stat>` is the id):

| Seal                 | Stat         | Token     |
| -------------------- | ------------ | --------- |
| Crucible Finisher    | power        | substance |
| Astral Vision        | intuition    | spirit    |
| Immovable Foundation | vitality     | matter    |
| Harmonic Sovereign   | charisma     | essence   |
| Tidal Chorus         | resonance    | essence   |
| Quicksilver Pivot    | adaptability | spirit    |
| Philosopher's Stone  | wisdom       | matter    |

Tiers: **Copper < Silver < Gold < Astral < Celestial**. A tier needs both gates:

| Tier      | Aligned rating | ESMS balance (whole tokens) | Contest multiplier |
| --------- | -------------- | --------------------------- | ------------------ |
| Copper    | 74             | 0.5                         | 1.05               |
| Silver    | 80             | 2                           | 1.10               |
| Gold      | 86             | 10                          | 1.18               |
| Astral    | 91             | 50                          | 1.28               |
| Celestial | 96             | 250                         | 1.40               |

The **aligned rating** is the contract's `computeMeanAlignedRating`: `rating − stat mean + 68.0`, using
its pinned means (76.5 / 67.0 / 68.5 / 64.5 / 66.0 / 67.5 / 66.0), so a gate sits a similar distance
above "typical" for every stat. Ratings and OVR stay on the raw scale.

**What ASOL adds.** Celestial also needs at least 4 of the 10 classical bodies natally in the token's
element (`placeholder` and `unattributed` charts count as none). It is implemented through the
contract's own Celestial bar (`evaluateSealTier(…, isPlaceholder)`), so every other tier is exactly the
contract's. `payload.seals` is the contract's list of **earned** seals (`buildCanonicalSeal`);
`payload.sealProgress` is every Seal's standing: `tier`, `nextTier`, `blockedBy` (`stat` / `esms` /
`natal`), `maxTier`, `statRating`, `alignedRating`, `balance`, `natalAffinity`.

**`maxTier`.** With the contract's means a perfect `power` aligns to `99 − 76.5 + 68 = 90.5`, short of
the Astral gate (91): Crucible Finisher tops out at **Gold** (`maxTier: "Gold"`, `nextTier: null` once
reached). The other six reach Celestial.

## Resonance Surge

The contract's `evaluateSurgeState(meter, heat, reactivity, primary, secondary, monica)` decides the
state; ASOL supplies the meter. `heat` and `reactivity` from the canonical thermodynamics payload
(`lib/thermodynamics/kalchm.ts`; nothing is re-derived here) ramp between sky-measured anchors
(`DEFAULT_SURGE_CALIBRATION`, pinned by `test/agents/surge-calibration.spec.ts`) into 0–1 **ramp
positions**; `skyMeter = 100·(½·heat position + ½·reactivity position)`. An optional natal chart plus the
live sky adds a bounded elemental-harmony offset of −12…+12. The contract rounds and clamps the meter and
treats it as **active at ≥ 70**.

- `inferno` — heat position ≥ reactivity position; `tempest` otherwise; `equilibrium` — active **and**
  Monica within 0.001 of 1.618.
- Boosts apply to all seven stats while active: the vessel's primary stat +12, secondary +8, the rest +4
  (equilibrium +16 / +12 / +8). The archetype is the vessel's, so the surge differs per vessel.
- `surge.heat` / `surge.reactivity` are the ramp positions; the engine's raw values are in `sky`.
- `monicaState` is `absent | equilibrium | convergent | divergent`. Monica never enters the meter: it is
  signed and unbounded, and `calculateMonica` documents why no near-equilibrium band can be derived.

## The live sky

`lib/agents/rating/live-sky.ts` takes positions from the **planetary-agents backend**
(`agentRequest('/planetary/current')`) only when the payload is stamped `source: "swiss-ephemeris"`
and `now` is within five minutes of the real clock (it serves the present); otherwise from the local
Keplerian approximation, whose `vsop87-approximation` label is carried into the result
(`payload.sky.source`). A partial sky (fewer than ten bodies) is never used. If neither source yields all
ten, `surge` is `null` and `degraded.sky` says why — a missing sky never looks like a calm one. This is
the one place the payload departs from the contract's type (`surge` is required there).

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
and wallet (the look is the contract's hand-authored pilot, faction Sun). Other ids are looked up as a
user-forged `historical_agents` row, in either natal-chart shape the app writes (the roster
`{ planets }` shape and the forge's `tropical.CelestialBodies`), and rated from persisted Sacred 7
columns when present, else from the chart (ascendant included, so the same chart rates the same). A
chart with a degree outside its sign or an ascendant outside the zodiac is not rated, and
`monicaConstant` is clamped to 0–10.

The response is the contract's `RatedAgentPayload` — `key`, `handle`, `faction`, `factionName`,
`isPlaceholder`, `provenance`, `appearance`, `ratings`, `relativeAdvantage`, `ovr`, `archetype`, `esms`,
`seals`, `surge | null` (and `avatarModelUrl` / `headMeshUrl` when known) — plus `scale`, `sealProgress`,
`esmsSource`, `zoneSynergies`, `bestZoneId`, `sky | null` and, only when something was read in a
degraded way, `degraded: { esms?, sky? }`. `faction` is a planet index (0 = Sun … 9 = Pluto): a
contract pilot's own, else the roster's, else the ruler of the natal Sun sign.

Statuses: `400` bad id, `404` unknown, `422` known but unratable, `429` (per-caller 120/min,
shared 1200/min; `RATING_API_PER_CALLER_PER_MIN`, `RATING_API_GLOBAL_PER_MIN`), `503` lookup
unavailable, `500` opaque. Always `Cache-Control: no-store`; CORS `*` for `GET`/`OPTIONS`.

### `GET /api/agents/rating?roster=true`

A light summary of every historical agent (`key`, `handle`, `faction`, `factionName`, `ovr`,
`archetype`, `era`, `crownStyle`, `signatureRelic`); reads neither the ledger nor the sky.
`Cache-Control: public, max-age=300`.

### `POST /api/agents/rating` (internal)

`Authorization: Bearer $INTERNAL_API_SECRET` (compared in constant time; `503` when unset, `401`
when wrong; no CORS). Body (≤ 4 KiB, enforced on bytes read, not on `Content-Length`):
`{ agentId, esms: { spirit, essence, matter, substance } }`, finite and non-negative.
Returns the recalculated payload. **It never writes the ledger**: ESMS balances are ledger-backed
and deliberately not editable from a request. A pushed holding is live SpacetimeDB state — used for
the recalculation and kept for 60 s per serverless instance, keyed by the ledger id, so a following
`GET` sees it (`esmsSource: "spacetimedb"`).

## Zone contests

`lib/agents/rating/pentacle-contest.ts`: eleven zones (Houses 0–4, Spires 5–9, Crown 10), each
with Sacred 7 weights and an ESMS element. `resolveZoneContest(attacker, defender, zoneId,
currentControl)` scores zone-weighted **ratings** (25–99) with the active surge's boosts (clamped by
the contract's `clampStat`) and the contract's per-tier Seal multiplier for the zone's token.

## Known limits

- **The contract's pinned numbers are not the live roster's.** `ROSTER_BASELINE_RATINGS` means are close
  to the roster's 0–100 stat means, not its 25–99 rating means (for `power`: pinned 76.5, roster mean
  rating 81.6), and its `baseline` of 63 is far below the roster median (83). Measured over the 72
  agents: `power` is the archetype primary of 46 of them (18 distinct titles), and mean alignment
  awards Gold on charisma and intuition to 9 and 12 agents against 2 and 1 under a roster-measured
  alignment. Re-measuring them is a one-file change in `rating-contract.ts`; the `it.fails`
  diagnostics in `test/agents/rating-contract-parity.spec.ts` go red the day it lands.
- Rate limits and the pushed cache are per serverless instance (best effort), and
  `getClientIp` trusts the first `x-forwarded-for` token — a platform that does not overwrite it
  lets one client rotate its bucket.
- A forged vessel's chart has no provenance label (the app's calculator is a Keplerian
  approximation), so it can count toward Celestial.
- The ESMS gates (0.5 / 2 / 10 / 50 / 250) are policy, not measurement; the surge anchors are measured.
- `app/api/agents/[slug]/ratings` (#65) still serves heuristic stats and a surge fabricated from them;
  this route is the one that reads the live sky and the ledger.
- The forged-vessel lookup and the ledger reads are covered with fakes, not against Postgres.

## Files

| Concern                 | File                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| The contract            | `lib/agents/rating-contract.ts`, `lib/agents/vessel-appearance-manifest.ts` |
| Ratings, OVR, archetype | `lib/agents/rating/ovr-archetype.ts` (an adapter over the contract)         |
| Seals, Resonance Surge  | `lib/agents/rating/seals-surge.ts`                                          |
| Live sky                | `lib/agents/rating/live-sky.ts`, `lib/spacetime/derive-live-ephemeris.ts`   |
| ESMS holdings           | `lib/agents/rating/esms-balance-resolver.ts`, `esms-ledger-store.server.ts` |
| Zone contests           | `lib/agents/rating/pentacle-contest.ts`                                     |
| Payload assembly        | `lib/agents/rating/vessel-payload.ts`                                       |
| Route                   | `app/api/agents/rating/route.ts`                                            |
