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
and wallet (it is named "Adept Neo", provenance `user`, faction Sun and wears the contract's hand-authored pilot look, as in the contract's fixtures; the four pilots take their `handle`, `provenance` and `faction` from `FIXTURE_AGENTS`). Other ids are looked up as a
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

The contract's optional progression fields (`vesselLevel`, `totalXp`, `xpToNextLevel`, `levelBoost`,
`baseOverall`, `trainedOverall`, `currentOverall`, `transitDelta`, `progressionStatus`,
`ratingAsOf`, `progressionReasons`, `expBreakdown`, `trainingEvidence`, `planetaryStats`,
`statDeltas`, `esmsAxisAttribution`) come from `computeAgentProgression` in
`lib/agents/leveling-service.ts`, passed into `buildRatedAgentPayload` so that this route and
`/api/agents/[slug]/ratings` serve the same numbers. An agent the experience ledger does not know —
a vessel someone forged — gets `progressionStatus: "unavailable"` and `null` numbers, never a
made-up level 1.

Statuses: `400` bad id, `404` unknown, `422` known but unratable, `429` (per-caller 120/min,
shared 1200/min; `RATING_API_PER_CALLER_PER_MIN`, `RATING_API_GLOBAL_PER_MIN`), `503` lookup
unavailable, `500` opaque. Always `Cache-Control: no-store`; CORS `*` for `GET`/`OPTIONS`. A
forged vessel's `200` also sends `CDN-Cache-Control: no-store` and `Vary: Authorization, Cookie,
X-Internal-Secret`: its answer depends on who asks, and `vercel.json` gives every `/api/*` response
`s-maxage=60` (function headers win, but the CDN is told directly too, as `[slug]/ratings` does).

**In the app.** `AgentRatingCard` (`components/vessel/agent-rating-card.tsx`) reads this route
from the browser on `/agent/[id]`, with the session cookie, so a vessel's creator sees their own
wallet. The page mounts it only for a view that is not restricted (a roster figure, the
creator, an admin): the payload carries chart-derived fields — `sealProgress[].natalAffinity`,
`surge.harmonyOffset` — that a stranger's restricted view withholds. It validates what it reads
with zod against `RatedVesselPayload` (a drift guard fails `tsc`), and shows a missing sky as
missing and a baseline wallet as a baseline, never as a calm ring or real holdings.

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
- **`equilibrium` is not reachable on the live sky.** The contract requires Monica within 0.001 of 1.618
  (exact Kalchm equilibrium); over 4000 epochs 2020–2035 the live sky's Monica spans −0.004…0.149
  (median 0.013), so the +16 / +12 / +8 boosts never fire. When both ramps saturate (both positions 1,
  meter 100) the contract's `heat >= reactivity` tie goes to `inferno`.
- **A forged vessel's `faction` is the ruler of its natal Sun sign, and its look is drawn from that
  faction**, so a person's Sun-sign bucket is public through `GET /api/agents/rating` (it is already
  public through `GET /api/agents`, which lists forged vessels' birth data and natal chart, see below).
- Seeded `planetary-*` / `moon-phase-*` rows rated through the forged path are labelled provenance `user`.
- Rate limits and the pushed cache are per serverless instance (best effort), and
  `getClientIp` trusts the first `x-forwarded-for` token — a platform that does not overwrite it
  lets one client rotate its bucket.
- A forged vessel's chart has no provenance label (the app's calculator is a Keplerian
  approximation), so it can count toward Celestial.
- The ESMS gates (0.5 / 2 / 10 / 50 / 250) are policy, not measurement; the surge anchors are measured.
- `app/api/agents/[slug]/ratings` (#65) still serves heuristic stats and a surge fabricated from them;
  this route is the one that reads the live sky and the ledger.
- The forged-vessel lookup and the ledger reads are covered with fakes, not against Postgres.

## Two-Tier Progression & Celestial Dignity Rating Engine

Vessel performance is decomposed into two distinct, orthogonal layers:

1. **Permanent Vessel Progression ($V$)**: Earned through lifetime EXP and verified training evidence. Monotonically non-decreasing; never reduced by unfavorable skies.
2. **Dynamic Celestial Dignity Rating ($D$)**: Driven by real-time ephemeris aspect geometry, planetary reception, and essential dignity. Fluctuates smoothly in $[-15, +15]$ OVR points.

### Scalar vs. Vector Taxonomy

| Domain              | Quantity                                     | Type             | Scale / Range                                   | Mathematical Role                                                                                 |
| :------------------ | :------------------------------------------- | :--------------- | :---------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Permanent ($V$)** | $\mathbf{S}_{\text{vessel}}$                 | **Vector (19D)** | Sacred: $[25, 99]$<br>Planetary: $[0, 100]$     | Base permanent stat vector across Sacred 7 and Planetary 12.                                      |
| **Permanent ($V$)** | $\text{TotalXP}$                             | **Scalar**       | $[0, \infty)$                                   | Lifetime accumulated experience (25 EXP / verified training conversation).                        |
| **Permanent ($V$)** | $\text{VesselLevel}$                         | **Scalar**       | $[1, 100]$                                      | $1 + \lfloor\sqrt{\text{TotalXP} / 100}\rfloor$, capped at 100.                                   |
| **Permanent ($V$)** | $\text{LevelBoost}$                          | **Scalar**       | $[0.0, +12.0]$                                  | $12 \cdot (\text{Level} - 1) / 99$ additive boost to base composite.                              |
| **Permanent ($V$)** | $\text{TrainedOverall}$                      | **Scalar**       | $[25.0, 99.0]$                                  | $\text{clamp}_{[25, 99]}(\Phi(\mathbf{S}_{\text{vessel}}) + \text{LevelBoost})$. Never decreases. |
| **Dynamic ($D$)**   | $\boldsymbol{\Delta}_{\text{dignity}}$       | **Vector (19D)** | Sacred: $[-18, +18]$<br>Planetary: $[-24, +24]$ | Active sky deltas in native stat scales via hybrid projection.                                    |
| **Dynamic ($D$)**   | $R_{\text{dignity}}$ ($\text{transitDelta}$) | **Scalar**       | $[-15.0, +15.0]$                                | Blended OWA ($40\%$) + uniform ($60\%$) celestial rating swing.                                   |
| **Composite**       | $OVR_{\text{current}}$                       | **Scalar**       | $[25.0, 99.0]$                                  | $\text{clamp}_{[25, 99]}(\text{TrainedOverall} + R_{\text{dignity}})$.                            |

$$\mathbf{S}_{\text{current}} = \text{clamp}_{\text{native}}(\mathbf{S}_{\text{vessel}} + \boldsymbol{\Delta}_{\text{dignity}})$$

$$OVR_{\text{current}} = \text{clamp}_{[25, 99]}(\text{TrainedOverall} + R_{\text{dignity}})$$

---

### Diagnostic Audit: The Four-Stage Variance Collapse in Legacy $\pm 8$ System

In the legacy implementation, live ephemeris skies produced `transitDelta` values tightly clustered around $[-2.5, +2.5]$, making the theoretical $\pm 8$ ceiling unreachable:

1. **Stage 2 (Aspect Averaging Dilution):** Dividing active transits by the full denominator ($\sum w_j = 13$) averaged 2–4 active orbs with 7–9 inactive zeroes, cutting response magnitude by $65\%\text{--}80\%$.
2. **Stage 2 (Blind Conjunctions & Missing Essential Dignity):** Conjunctions awarded a static $+1.0$ unconditionally, ignoring planetary natures (e.g. Saturn in Fall afflicting a luminary was treated as a $+1.0$ buff). Planets transiting their own Domicile/Exaltation received zero baseline dignity.
3. **Stage 3 ($L_1$ Affinity Contraction):** Averaging across $\mathbf{r}$ with $L_1$ normalization induced central-limit cancellation ($\|\boldsymbol{\rho}\|_\infty \ll \|\mathbf{r}\|_\infty$).
4. **Stage 4 (Archetype Dampening):** Coefficients $c_k \in [0.75, 1.00]$ suppressed sensitivity by $15\%\text{--}25\%$ rather than amplifying signature stats.

**Net Result:** $\mathbb{E}[|R_{\text{dignity}}|] \approx 8 \times 0.11 \times 0.82 \approx 0.72$ OVR points.

---

### Upgraded Mathematical Architecture ($\pm 15$ OVR / $\pm 18$ Stat Swing)

The upgraded engine in `lib/vessel/progression.ts` resolves all four bottlenecks:

#### Stage 1.5: Essential Dignity & Reception ($d_{\text{ess}} \in [-3, +3]$)

Each transiting body evaluates against canonical classical sign rulers:

- **Domicile:** $+3$ | **Exaltation:** $+2$ | **Triplicity/Peregrine:** $0$ | **Detriment:** $-2$ | **Fall:** $-3$

Essential posture of natal body $i$:
$$b_i = \frac{d_{\text{ess}}(\lambda_{\text{sky}, i})}{3} \in [-1, +1]$$

Conjunction base polarities adapt to the transiting body's nature and essential dignity:
$$A_{\text{conj}}(j) = \text{clamp}_{[-0.85, +1.0]}\left(A_{\text{base}}(j) + 0.20 \cdot d_{\text{ess}}(\lambda_{\text{sky}, j})\right)$$
where $A_{\text{base}}$ provides benefic/malefic weighting (Sun $0.85$, Moon $0.80$, Venus $0.90$, Jupiter $0.95$, Mars $0.25$, Saturn $0.25$, Pluto $0.20$).

#### Stage 2: Root-Energy Active Aspect Pooling & 4D ESMS Wavefunction Coupling

Active transits pool into an active-energy normalized hyperbolic tangent coupled with the 4D Alchemical Wavefunction $\boldsymbol{\Psi}(t) = (\Psi_{\text{Spirit}}, \Psi_{\text{Essence}}, \Psi_{\text{Matter}}, \Psi_{\text{Substance}}) \in [-2, 2]^4$ (`lib/vessel/esms-wavefunction.ts`):

- **Channel A (Ambient Alchemical Tide $\psi_i(t) \in [-1, 1]$):**
  $$\psi_i(t) = \text{clamp}_{[-1, 1]}\left(\frac{1}{2} \sum_{a \in \text{ESMS}} u_{i,a} \cdot \Psi_a(t)\right), \quad \sum_a u_{i,a} = 1$$
- **Channel B (Dyadic Chord Reception Gain $G_{i,j}(t) \in [0.65, 1.35]$):**
  $$G_{i,j}(t) = \text{clamp}_{[0.65, 1.35]}\left(1 + 0.35 \cdot \left(\frac{\psi_i(t) + \psi_j(t)}{2}\right) \cdot \text{sign}(P_{i,j})\right) > 0$$
- **Active-Energy Normalized Pooling:**
  $$E_i = \frac{\sum_{j=1}^{11} w_{i,j} \cdot P_{i,j} \cdot G_{i,j}(t) \cdot \alpha(\text{orb}_{i,j})}{\sqrt{\sum_{j=1}^{11} w_{i,j}^2 \cdot \mathbb{I}(|\text{Response}(i, j)| > 0) + \tau^2}}$$
  $$r_i = \tanh\left(\kappa_{\text{aspect}} \cdot E_i + \kappa_{\text{ess}} \cdot b_i + \kappa_{\psi} \cdot \psi_i(t)\right) \in (-1, +1)$$
  with damping floor $\tau^2 = 2.25$ ($\tau = 1.5$), $\kappa_{\text{aspect}} = 1.15$, $\kappa_{\text{ess}} = 0.35$, and $\kappa_{\psi} = 0.12$.
  A single exact Solar Return ($w_{i,j} = 3.0$) drives $r_{\text{Sun}} \ge 0.80$ without zero-dilution from inactive planets, while exposing 4D `esmsAxisAttribution` $\in [-1, 1]^4$ on `VesselProgression`.

#### Stage 3 & 4: Variance-Preserving Projection & Archetype Amplification

- **Hybrid $L_1 \times L_2$ Projection:**
  $$\rho_k = \text{clamp}_{[-1, +1]}\left(\frac{\mathbf{A}_k \cdot \mathbf{r}}{\sqrt{\|\mathbf{A}_k\|_1 \cdot \sqrt{\sum w^2}}}\right)$$
- **Archetype Amplifier ($c_k \in [0.85, 1.35]$):**
  $$c_k = 0.85 + 0.30 \cdot \text{overlap}(\mathbf{A}_k, \mathbf{A}_{\text{primary}}) + 0.20 \cdot \text{overlap}(\mathbf{A}_k, \mathbf{A}_{\text{secondary}})$$
- **19D Stat Deltas:**
  $$\Delta_k = \text{clamp}_{[-M_k, +M_k]}\left(\rho_k \cdot c_k \cdot \left(\frac{15}{74}\right) \cdot \text{Scale}_k\right)$$
  where $M_k = 18$ for Sacred 7 ($\text{Scale}_k = 74$) and $M_k = 24$ for Planetary 12 ($\text{Scale}_k = 100$).

#### Stage 5: OWA-Coupled Scalar Dignity Rating ($R_{\text{dignity}} \in [-15, +15]$)

Combines unified functional delta ($60\%$) with signature Sacred OWA delta ($40\%$) using the convex 7-stat weight vector $\mathbf{w}_{\text{OWA}} = \frac{1}{7.9}[1.6, 1.3, 1.0, 1.0, 1.0, 1.0, 1.0]$ ($\sum w_i = 1.0$):
$$\Delta\Phi_{\text{uniform}} = \Phi(\mathbf{S}_{\text{vessel}} + \boldsymbol{\Delta}_{\text{dignity}}) - \Phi(\mathbf{S}_{\text{vessel}})$$
$$\Delta\Phi_{\text{OWA}} = \mathbf{w}_{\text{OWA}} \cdot \boldsymbol{\Delta}_{\text{sacred},\,\pi(\mathbf{S}_{\text{vessel}})} = \frac{1.6 \cdot \Delta_{\text{primary}} + 1.3 \cdot \Delta_{\text{secondary}} + \sum_{r=1}^{5} 1.0 \cdot \Delta_{\text{rest}, r}}{7.9}$$
$$R_{\text{dignity}} = \text{clamp}_{[-15, +15]}\left(0.60 \cdot \Delta\Phi_{\text{uniform}} + 0.40 \cdot \Delta\Phi_{\text{OWA}}\right)$$

---

### Side-by-Side Comparison: Legacy vs. Upgraded System

| Metric / Scenario                                      | Legacy System ($\pm 8$)     | Upgraded System ($\pm 15$)              |
| :----------------------------------------------------- | :-------------------------- | :-------------------------------------- |
| **Hard Scalar Bounds ($R_{\text{dignity}}$)**          | $[-8, +8]$                  | $[-15, +15]$ (30-point dynamic window)  |
| **Max Per-Stat Delta (Sacred / Planetary)**            | $\pm 8.0$ / $\pm 10.8$      | $\pm 18.0$ / $\pm 24.0$                 |
| **Typical Everyday Live Sky ($1\sigma$ RMS)**          | $\pm 0.8$ to $\pm 1.6$ OVR  | $\pm 4.0$ to $\pm 6.5$ OVR              |
| **Major Transit Event (Solar Return + Jupiter Trine)** | $+2.4$ to $+3.5$ OVR        | $+9.0$ to $+13.0$ OVR                   |
| **Heavy Affliction (Mars Fall Sq. + Saturn Opp.)**     | $-2.0$ to $-3.1$ OVR        | $-8.5$ to $-13.5$ OVR                   |
| **Extreme Multi-Planet Alignment (Peak Window)**       | $+5.2$ OVR                  | $+14.0$ to $+15.0$ OVR                  |
| **Relation to Max LevelBoost ($+12$)**                 | Subordinate ($\max 8 < 12$) | Can overtake level gap ($\max 15 > 12$) |

---

### UI & Arena HUD Badge Thresholds

Downstream display surfaces (including `VesselProgressionDisplay`) calibrate celestial transit tiers according to the expanded dynamic range:

- **Notable Transit:** $|R_{\text{dignity}}| \ge 4.0$ OVR
- **Strong Alignment / Affliction:** $|R_{\text{dignity}}| \ge 8.0$ OVR
- **Peak Exaltation / Severe Affliction:** $|R_{\text{dignity}}| \ge 12.0$ OVR

---

## Files

| Concern                                 | File                                                                        |
| :-------------------------------------- | :-------------------------------------------------------------------------- |
| The contract & bounds                   | `lib/agents/rating-contract.ts`, `lib/agents/vessel-appearance-manifest.ts` |
| Ratings, OVR, archetype                 | `lib/agents/rating/ovr-archetype.ts` (adapter over contract)                |
| Seals, Resonance Surge                  | `lib/agents/rating/seals-surge.ts`                                          |
| Live sky                                | `lib/agents/rating/live-sky.ts`, `lib/spacetime/derive-live-ephemeris.ts`   |
| ESMS holdings                           | `lib/agents/rating/esms-balance-resolver.ts`, `esms-ledger-store.server.ts` |
| Zone contests                           | `lib/agents/rating/pentacle-contest.ts`                                     |
| Payload assembly                        | `lib/agents/rating/vessel-payload.ts`                                       |
| 4D ESMS Wavefunction & Stage 2 coupling | `lib/vessel/esms-wavefunction.ts`                                           |
| Vessel progression & dignity engine     | `lib/vessel/progression.ts`, `lib/vessel/stat-resolver.ts`                  |
| Lean 4 formal verification              | `proofs/lean/Proofs/Wavefunction.lean`                                      |
| Vessel progression UI display           | `components/vessel/vessel-progression-display.tsx`                          |
| Live rating card (`/agent/[id]`)        | `components/vessel/agent-rating-card.tsx`                                   |
| Route                                   | `app/api/agents/rating/route.ts`                                            |
