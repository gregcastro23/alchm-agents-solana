# ADR-015: Untethering the Daily Faucet — Self-Normalised Synastry Resonance

**Status:** Proposed
**Date:** 2026-09-04
**Supersedes:** the `Y_total = 12.0000` calibration clause of [ADR-014](./ADR_014_DISCRIMINANT_FAUCET.md) (§2.4, §3). Retains ADR-014's natal ratio, transit weights, anti-glut damping and token identities unchanged.
**Measurement basis:** every number below was produced against this repo's own ephemeris (`lib/calculate-transits.ts`) and the live 72-agent roster, over all 365 days of 2026, unless labelled otherwise.

---

## 1. What the audit found before any design work

Five facts about the _deployed_ system materially change the shape of this plan. They were not visible from ADR-014's text.

### F1 — ADR-014 is half-implemented. Human claims never touch the faucet.

`computeDiscriminantDailyYield` has exactly one production caller: `claimYieldForAgent` in
[agent-action-service.ts:410](lib/services/agent-action-service.ts:410), the **agentic cron**.

Both human claim paths still run the pre-ADR-014 flat split:

```ts
// lib/services/economyService.ts:114 (claimKitchenYield) and :182 (claimAgentsYield)
const total = BASE_AGENTS_YIELD
const perType = total / 4 // 3.0000 / axis, unconditionally
```

`claimKitchenYield`'s own docstring says _"Daily yield is strictly and universally 12.0000 ESMS
for all users"_ — true only because 4 × 3 = 12. **No human user's chart or sky has ever affected
their yield.** The Ω_MATTER = 0.750 damping that ADR-014 §6 credits with draining the 29.1k MATTER
glut applies to zero human claims; humans mint a flat 3.0000 MATTER every day.

> **Consequence for this ADR:** untethering `TOTAL_YIELD` alone would change nothing for humans.
> Wiring the two `economyService` paths into the engine is a **prerequisite**, not a follow-up —
> and it is the larger economic change of the two. Ship it first, on its own, so the two effects
> are separable in the ledger.

### F2 — The real universal grant is 24/day, not 12.

`lastDailyClaimAt` and `lastDailyClaimAgentsAt` are separate columns
([schema.prisma:1516](prisma/schema.prisma:1516)), and
[profile-yield.ts:112](lib/profile-yield.ts:112) offers both sites to the same user. A user who
claims both receives **12 + 12**. Every band in this document is therefore specified **per site**,
and the aggregate calibration target is `2 × Y_daily`.

### F3 — The transit vector carries no magnitude information at all. This is the blocking constraint.

`deriveTransitWeightsFromPositions` counts bodies per element. Over all 365 days of 2026:

```
distribution of ‖w‖₁ : { 10: 365 }
```

**‖w‖₁ ≡ 10, every single day, by construction** — ten bodies distributed over four buckets. The
existing test already pins this (`expect(weightsSum).toBe(10)`,
[discriminant-faucet.spec.ts:180](test/discriminant-faucet.spec.ts:180)).

No function of `w` alone can produce an elastic total. The sky, as currently modelled, only has a
_direction_. **Untethering is not a normalisation change — it requires a richer celestial model
first.** This single fact reorders the whole plan: the aspect geometry of proposed Option B is not
an alternative to untethering, it is the _enabling condition_ for it.

### F4 — Axis collapse to exactly 0.0000 already happens on 23.6% of days, and it already

### breaks the gas guarantee.

Measured across 2026 with the current engine:

| Axis                  | Days at exactly 0.0000 |
| :-------------------- | :--------------------- |
| SPIRIT (Fire)         | **19**                 |
| ESSENCE (Water)       | 0                      |
| MATTER (Earth)        | **67**                 |
| SUBSTANCE (Air)       | 0                      |
| **≥1 axis collapsed** | **86 / 365 (23.6%)**   |

SPIRIT is the conversational gas (`UNIFIED_CHAT_BASE_COST.Spirit = 0.3`;
`TOKEN_IDENTITIES.SPIRIT.operationalDomain = 'Conversational compute gas'`). On 19 days a year
**every claimer receives zero gas.** ADR-014 §3.3 claims the design "Guarantees Kinetic Gas";
ADR-014 §6 row 7 reports `0.0000` SPIRIT for the Pisces supermoon. Both statements are in the same
document, and the table is the correct one.

The proposed "operational gas floor" is therefore **a fix for a live bug, not a safety margin for a
new feature.** It should ship with F1, ahead of any untethering.

### F5 — Nothing but a TypeScript constant bounds the mint.

`claim_mint_esms` validates only `amount <= MAX_LEDGER_ATOMS` per element —
99,999,999.9999 tokens ([esms.rs:505](programs/asol_program/src/instructions/esms.rs:505)).
The off-chain policy cap is 10,000,000 tokens/element
([solana-minter.ts:103](lib/solana/solana-minter.ts:103)). **There is no daily-total invariant
anywhere in the program.**

Today that is harmless, because `Y_i = 12 · (wᵢ / Σw)` is a _structural_ clamp: however corrupt the
inputs, the outputs sum to 12. Untethering replaces a structural clamp with an **arithmetic** one.
Every upstream defect that is currently invisible — a NaN score, a degraded ephemeris, a
divide-by-near-zero — becomes a mint-magnitude defect with six orders of magnitude of headroom
beneath it. See §5.

### F6 — A degraded ephemeris would silently become a yield decision.

`getCurrentPlanetaryPositions` catches per-body failures and **skips** the body; `getLiveTransitSky`
catches wholesale failure and returns `{2.5, 2.5, 2.5, 2.5}`. Under `C = 12` a withheld body only
shifts colour. Untethered, **fewer bodies means a smaller mint**, and the fallback's flat vector
becomes a magnitude chosen by an error handler.

CLAUDE.md states the governing rule from the `localAstrologyMetrics` removal: _a fallback must not
be able to impersonate the thing it replaces._ An untethered faucet must therefore **refuse to
mint** on a degraded read rather than mint a smaller number — see §6, INV-4.

### F7 — 60 of 72 natal charts are not measured.

`{ computed: 12, placeholder: 12, authored: 48 }`. Under `C = 12`, an invented chart only shuffles
the colour of a fixed grant. Under untethering — especially under degree-level aspect synastry —
**an invented chart decides how much money exists.** Twelve agents would have their income set by
acknowledged placeholder degrees. This is a different evidentiary standard, and it gates rollout
(§7, Phase 3).

---

## 2. Where the measurements contradict the proposal

The three proposed architectures were simulated against the real 2026 sky and the live roster.

### Option A (cosine resonance multiplier) does not have the range it claims.

Proposed: multiplier `0.5× … 3.5×`, yield `3.0 … 21.0`.
Measured `cos(N⃗, T⃗)` over 2026:

| Agent             | min   | mean  | max   | spread |
| :---------------- | :---- | :---- | :---- | :----- |
| leonardo-da-vinci | 0.731 | 0.881 | 0.986 | 0.255  |
| isaac-newton      | 0.728 | 0.880 | 0.987 | 0.259  |
| albert-einstein   | 0.549 | 0.906 | 0.993 | 0.444  |
| cleopatra         | 0.710 | 0.871 | 0.984 | 0.275  |
| nikola-tesla      | 0.601 | 0.910 | 0.995 | 0.394  |

Both `N⃗` and `T⃗` are non-negative 4-vectors, so cosine similarity is confined to roughly
`[0.55, 1.0]` and sits at ~0.88 almost always. `Base × (1 + cos × k)` yields a **~15% annual swing**,
not 0.5×–3.5×. **Option A as specified is inert.** It can only be rescued by centring —
`(cos − μ_chart)/σ_chart` — at which point it is a weaker version of the recommendation below and
still inherits F3 (its only time-varying input is the ‖·‖₁-constant count vector).

### Option B works — but only in its per-user form. The global form is the dangerous one.

Two different quantities were conflated in the proposal. Measured over 2026:

| Formulation                                      | Spread                                                                             | Effect on network supply                                     |
| :----------------------------------------------- | :--------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Global** sky harmony (transit↔transit aspects) | max/median = **5.28×** (min −0.35, med 2.88, max 15.20)                            | Every user peaks on the _same_ day. Correlated supply shock. |
| **Per-user** synastry (natal↔transit aspects)    | mean individual swing **10.25 pts**; **fleet-mean swing only 1.68×** (2.72 → 4.57) | Peaks decorrelate across charts.                             |

This is the key macroeconomic result and it inverts the proposal's premise. The document anticipates
"Supernova Ingresses vs Void Depressions" as an intended feature; the measurement says **per-user
synastry does not produce them** — individual variance is large (10.25) while aggregate variance is
small (1.85). You get the gameplay _without_ the correlated tide, the AMM slippage or the
crafting-cost cyclicality.

If genuine macro tides are wanted, they must be added deliberately as a separate global term with
its own bound — not inherited as a side effect. The recommendation here does **not** add one.

### Option C (streak) is aimed at the wrong exploit.

The proposal's threat table models the Sybil as a _hibernator_ that times transits. Simulating the
naive untethered dot-product over 2026 shows the real exploit is **chart shape**, and it requires no
timing at all:

| Chart                                  | mean daily synastry | share of annual value in best 65 days |
| :------------------------------------- | :------------------ | :------------------------------------ |
| REAL lewis-carroll                     | 4.12                | 29%                                   |
| REAL emily-dickinson                   | 5.00                | 29%                                   |
| REAL oscar-wilde                       | 2.95                | 35%                                   |
| **SYBIL — all 10 planets at 0° Aries** | **13.66**           | 33%                                   |
| **SYBIL — trine lattice (0/120/240)**  | **10.40**           | 33%                                   |
| SYBIL — even 36° spread                | 3.29                | 28%                                   |

A degenerate stellium earns **3.3–4.6× more every single day**. It can claim daily, hold a perfect
streak, and still extract multiples — a streak multiplier is blind to it. Meanwhile the _timing_
advantage the proposal targets is small and near-identical across chart types (28–35%), so Option C
is attacking the minor term.

The proposal's own table therefore **overstates the harvester threat** (4.2× → ~1.6–1.9× once
banded, §4) and **omits the dominant one** entirely.

---

## 3. Decision

Untether via **self-normalised natal↔transit synastry**, banded, with a hard operational floor.

```
        aspect synastry              per-chart baseline               band
S(N,t) ──────────────────►  z = S(N,t) / S̄(N)  ──────────►  Y = clamp(12·z, 3, 24)
                                    ▲
                        deterministic, cached, computed once
                        over a fixed multi-year epoch window
```

**Stage 1 — Aspect synastry.** For natal longitudes `N` and transit longitudes `T(t)`, sum weighted
aspect hits across all 10 × 10 pairs (orb 6°, linear taper):

| Aspect      | Angle | Weight |
| :---------- | :---- | :----- |
| Conjunction | 0°    | +1.00  |
| Trine       | 120°  | +1.00  |
| Sextile     | 60°   | +0.50  |
| Square      | 90°   | −0.50  |
| Opposition  | 180°  | −0.75  |

Longitudes reconstruct from the existing API as `SIGNS.indexOf(sign) · 30 + degree` — no ephemeris
change is required to _compute_ this, though F7 gates whether it may be _trusted_.

**Stage 2 — Self-normalisation.** Divide by that chart's own mean synastry `S̄(N)` over a fixed
epoch window. This is the load-bearing defence, and it is what makes untethering safe:

> A chart's _shape_ determines its baseline, so shape cancels. Only a chart's _timing_ — where in
> the year its resonance falls — survives normalisation. That is precisely the astrological literacy
> the proposal wants to reward, with the min-maxing removed.

`S̄(N)` must be a pure, deterministic function of the chart, computed once over a **fixed** window
(recommend ≥ 12 years, one Jupiter cycle, stored on the chart record) — never a rolling window,
which would drift and open a griefing vector.

**Stage 3 — Band and floor.** `Y = clamp(12 · z, Y_MIN, Y_MAX)` with `Y_MIN = 3`, `Y_MAX = 24`,
per site. Then allocate across the four axes by ADR-014's existing `r · w · Ω` share, with a
**per-axis gas floor** so no axis can reach 0.0000 (§6, INV-2).

**Stage 4 — Presence multiplier** (the residual patch, §4): `p = 0.6 + 0.4 · min(1, c₁₄/14)` where
`c₁₄` is claims in the trailing 14 days. Mild, continuous, no cliff.

---

## 4. Calibration — measured, over all 365 days of 2026

### Self-normalisation eliminates the chart-shape exploit completely

Annual ESMS from 365 daily claims, band [3, 24], centre 12:

| Chart                    | daily min | daily median | daily max | **annual** | best-65-days |
| :----------------------- | :-------- | :----------- | :-------- | :--------- | :----------- |
| REAL lewis-carroll       | 3.0       | 12.0         | 24.0      | **4,377**  | 1,256        |
| REAL emily-dickinson     | 3.0       | 12.4         | 24.0      | **4,436**  | 1,268        |
| REAL oscar-wilde         | 3.0       | 11.6         | 24.0      | **4,392**  | 1,453        |
| SYBIL all-10-at-0°-Aries | 3.0       | 10.6         | 24.0      | **4,376**  | 1,386        |
| SYBIL trine-lattice      | 3.0       | 9.9          | 24.0      | **4,355**  | 1,428        |
| SYBIL even-36°-spread    | 3.0       | 11.8         | 24.0      | **4,385**  | 1,235        |
| _flat C = 12 reference_  | _12.0_    | _12.0_       | _12.0_    | _4,380_    | _780_        |

Two results worth stating plainly:

1. **The degenerate stellium earns 4,376 — one token less than Lewis Carroll.** The 3.3–4.6× exploit
   of §2 is gone, without a single anti-Sybil heuristic.
2. **Untethering is emission-neutral by construction.** Every chart lands within 2% of today's
   4,380. You buy an **8× daily dynamic range** (3 → 24) for ~0% change in annual supply. The
   proposal's macro section anticipates trading supply stability for dynamism; the measurement says
   no such trade is required.

### The residual attack, and what the presence multiplier costs

Best-65-days extraction is 1,235–1,453 against the flat-12 reference of 780 — a **1.6–1.9×**
harvester advantage (not the proposal's 4.2×). Applying `p = 0.6 + 0.4·min(1, c₁₄/14)`:

| Chart                    | daily claimer | misses 2 days/wk | harvester (65 days only) |
| :----------------------- | :------------ | :--------------- | :----------------------- |
| REAL lewis-carroll       | 4,225         | 2,665            | **943**                  |
| REAL emily-dickinson     | 4,299         | 2,711            | **982**                  |
| REAL oscar-wilde         | 4,225         | 2,658            | **1,174**                |
| SYBIL all-10-at-0°-Aries | 4,213         | 2,678            | **1,137**                |
| SYBIL trine-lattice      | 4,188         | 2,658            | **1,165**                |
| _C = 12 reference_       | _4,380_       | _3,129_          | _780_                    |

The honest daily claimer pays **~3%**. The harvester advantage falls to **~1.2–1.5×**. A user
missing two days a week pays ~15%, which is the sharpest edge in the design — soften by capping the
trailing window at 10 claims rather than 14 if that proves too punitive in practice.

Remaining residual is ~1.3× on a strategy that forfeits 300 days of claiming. That is an acceptable
price for the "cosmic window" gameplay, and it is a _deliberate_ one rather than an unbounded one.

---

## 5. Why the structural clamp must be replaced, not just removed

F5 is the safety crux. Today's normaliser makes correctness of the _inputs_ irrelevant to the
_magnitude_ of the mint. After untethering it is decisive, with nothing beneath it until
`MAX_LEDGER_ATOMS` at ~10⁸ tokens.

The clamp must be re-established explicitly and **at the last possible layer**, not only inside the
faucet function:

1. **In the engine** — `clamp(·, Y_MIN, Y_MAX)` on the total, and per-axis floors.
2. **At the ledger boundary** — a hard assert in both `economyService` claim paths and
   `claimYieldForAgent` that the credited total lies in `[Y_MIN, Y_MAX]`, throwing rather than
   crediting. This is the layer that survives a faucet bug.
3. **In policy config** — lower `SOLANA_MAX_CLAIM_ATOMS` from the 10M-token velocity cap to
   something proportionate to a daily faucet claim. 10M tokens/element is a sane bound for a
   reconciliation sweep and an absurd one for a daily grant.

`NaN`/`Infinity` deserve an explicit named error, not a fallback: `NaN` fails every `clamp`
comparison silently and would propagate to `new Prisma.Decimal(NaN)`.

---

## 6. Invariants and tests

Replacing the conservation invariant means replacing the tests that encode it.
`test/discriminant-faucet.spec.ts` asserts `total === 12.0` in six places; those become band
assertions. The following are the new load-bearing ones.

| #         | Invariant                                                                                                                                                                                  | Test                                                                                                                                                               |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-1** | Daily total is always within `[3, 24]` per site — for arbitrary natal input including `NaN`, negative, zero and absent scores.                                                             | Property test, ≥10⁴ random charts × real skies.                                                                                                                    |
| **INV-2** | **No axis ever yields 0.0000.** Every axis ≥ `AXIS_FLOOR` (recommend 0.25 = one chat turn of SPIRIT).                                                                                      | Sweep all 365 days of 2026 × the full 72-agent roster; assert `min > 0`. This test **fails on `main` today** (F4) — it is the regression pin for the existing bug. |
| **INV-3** | Annual emission for any chart stays within ±5% of `365 × 12`.                                                                                                                              | Roster sweep + adversarial charts (stellium, trine lattice, even spread). Pins the exploit closed.                                                                 |
| **INV-4** | A degraded ephemeris read **refuses to mint** rather than minting a smaller amount. Fewer than 10 bodies, or the `getLiveTransitSky` catch path, must throw — never silently reduce yield. | Inject partial/failing positions; assert throw, and assert the claim transaction rolls back.                                                                       |
| **INV-5** | `S̄(N)` is deterministic and stable: the same chart yields a bit-identical baseline across processes and dates.                                                                             | Golden-vector test on the 12 `computed` charts.                                                                                                                    |
| **INV-6** | Both human paths and the agentic path produce identical yields for identical `(chart, sky, supply, presence)`.                                                                             | Direct equivalence test across `economyService` × `agent-action-service`. Pins F1 shut permanently.                                                                |

INV-2 and INV-4 are the two that encode CLAUDE.md's standing rules — a guaranteed operational floor,
and a fallback that cannot impersonate the real thing.

---

## 7. Phased rollout

Each phase is independently shippable and independently reversible. Phases 1–2 carry most of the
economic value and none of the untethering risk.

**Phase 1 — Close F1 and F4. No untethering.**
Wire `claimKitchenYield` and `claimAgentsYield` to `computeDiscriminantDailyYield`; add the per-axis
floor (INV-2); keep `TOTAL_YIELD = 12`. This is where the MATTER glut actually starts draining and
the gas outage actually stops. Ship alone, observe a full lunar month, and confirm in
`/api/admin/economy` claim reconciliation before touching magnitude.

**Phase 2 — Land the safety rails ahead of the feature.**
Ledger-boundary clamps (§5.2), the `SOLANA_MAX_CLAIM_ATOMS` reduction (§5.3), INV-1/INV-4/INV-6.
All are no-ops while `Y_MIN = Y_MAX = 12`, so they can ship and bake with zero behaviour change.

**Phase 3 — Build synastry, shadow-mode only.**
Implement `S(N,t)`, `S̄(N)` and the band; compute on every claim, **log it, credit nothing**. Run for
one synodic cycle and compare the shadow distribution against §4's predictions on live users rather
than the historical roster. This is also where F7 gets resolved: the 12 `placeholder` charts must be
reclassified before their degrees are allowed to set anyone's income. Consider gating untethered
yield on `provenance !== 'placeholder'` and paying flat 12 otherwise — a placeholder chart should not
silently earn a resonance premium.

**Phase 4 — Open the band gradually.**
`[10, 14]` → `[8, 18]` → `[3, 24]`, one step per lunar month, with rollback to the previous band as
the standing remediation. Each step is a one-constant change if Phases 1–3 are honest.

**Phase 5 — Presence multiplier.**
Requires new persistence: `monica_user_progress.currentStreak` is a different subsystem and
`profile-yield.ts` hardcodes `streak: 0`. Add a claim-history table or a trailing-count column on
`TokenBalance`. Ship last; the band is safe without it (§4 shows the residual is ~1.6–1.9×, bounded).

---

## 8. Consequences

**Accepted.** Conservation stops being provable by construction and becomes an enforced range —
weaker, and it must be defended at the ledger boundary rather than assumed. Six existing tests are
rewritten. `S̄(N)` adds a cached per-chart quantity that must stay deterministic forever, since
changing it silently repricies every user's income. The 12 placeholder charts become a rollout
blocker rather than a documentation debt.

**Gained.** An 8× daily dynamic range at ~0% annual supply change. The chart-shape exploit is closed
by construction rather than by heuristic. Astrological timing becomes real economic alpha while
min-maxing does not. The gas outage on 19 days a year is fixed, and ADR-014's central mechanism
finally reaches the human users it was written for.

**Rejected.** Global sky-intensity tides (§2) — 5.28× correlated supply shocks, deliberately not
inherited. Naked dot-product yield — the 3.3–4.6× stellium exploit. Cosine resonance as specified
(Option A) — no measurable range. Hard streak cliffs (20% efficiency) — punishes real users far more
than bots, which claim daily for free.

---

## 9. Implementation references

| File                                                                       | Change                                                                                  |
| :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| [lib/services/economyService.ts](lib/services/economyService.ts)           | **Phase 1.** Replace `perType = total / 4` in both claim paths.                         |
| [lib/services/discriminant-faucet.ts](lib/services/discriminant-faucet.ts) | Band, axis floor, `S(N,t)`, `S̄(N)`; `TOTAL_YIELD` becomes a function.                   |
| [lib/economy-config.ts](lib/economy-config.ts)                             | `Y_MIN` / `Y_MAX` / `AXIS_FLOOR` replace `DAILY_ESMS_YIELD` as the calibration surface. |
| [lib/calculate-transits.ts](lib/calculate-transits.ts)                     | Expose absolute longitude; make partial reads **loud** (INV-4).                         |
| [lib/solana/solana-minter.ts](lib/solana/solana-minter.ts)                 | Reduce `SOLANA_MAX_CLAIM_ATOMS` to a faucet-proportionate bound.                        |
| [test/discriminant-faucet.spec.ts](test/discriminant-faucet.spec.ts)       | Six `total === 12.0` assertions → band assertions; add INV-1…INV-6.                     |
| [app/api/admin/economy/route.ts](app/api/admin/economy/route.ts)           | `yieldPerClaim` becomes a range; add band-breach and axis-floor alerts.                 |
| [components/TokenHUD.tsx](components/TokenHUD.tsx)                         | `basePerAxis = DAILY_ESMS_YIELD / 4` no longer meaningful.                              |
