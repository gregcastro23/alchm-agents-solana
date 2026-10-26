# Permanent Vessel Level, dynamic Current Overall

The final product decision is two separate indicators: **Vessel Level accumulates permanently; Current Overall moves with the current chart.** Vessel Level raises the baseline around which Current Overall moves. A difficult transit never removes earned EXP.

The local reference implementation is in `lib/vessel/progression.ts` and `lib/vessel/experience.ts`. The first policy is deliberately versioned and tunable. The durable source adapters and historical migration described in [the integration plan](./vessel-progression-integration.md) are still required before production can claim complete lifetime experience across all sites.

## Calculation

1. **Accumulate experience.** Sum accepted, unique receipts for completed chats, verified historical training, qualified site actions, earned achievements, and settled Pentacles outcomes. Never recompute permanent experience from currently available counters or token balances.
2. **Calculate Vessel Level.** Initial curve: `L = min(100, 1 + floor(sqrt(EXP / 100)))`. Reaching level L costs `100 × (L − 1)²` total EXP. The next-level threshold, not total EXP itself, becomes unavailable at level 100; earned EXP continues accumulating.
3. **Calculate Base Overall from all 19 attributes.** Normalize Sacred 7 with `(stat − 25) / 74` and Planetary 12 with `stat / 100`. Then `Base Overall = 25 + 74 × (0.5 × mean(Sacred) + 0.5 × mean(Planetary))`. Each stat has positive influence; neither family dominates just because it contains more fields. Keep fractional precision until display.
4. **Apply permanent growth.** Initial Vessel boost is `12 × (L − 1) / 99` rating points. `Baseline Overall = clamp(Base Overall + boost, 25, 99)`.
5. **Apply the current chart.** Compare each current body to each natal body using wraparound-safe aspect geometry and a continuous orb taper. Explicit affinities map planetary effects to each of the 19 stats; character primary/secondary affinities shape their sensitivity. Recompute the weighted composite after these per-stat effects. `Current Overall = clamp(Baseline Overall + chart adjustment, 25, 99)`, with the chart adjustment bounded to ±8.

Level, its boost, family weights, and the ±8 range are initial game balance choices. They are not calibrated conclusions about the roster. The ceiling limits visible increases; an adverse chart may still pull a capped baseline downward.

| Vessel Level | Total EXP threshold | Baseline boost |
| ------------ | ------------------: | -------------: |
| 1            |                   0 |          +0.00 |
| 10           |               8,100 |          +1.09 |
| 25           |              57,600 |          +2.91 |
| 50           |             240,100 |          +5.94 |
| 100          |             980,100 |         +12.00 |

## All the stats, without counting their ingredients twice

The Sacred 7 are power, resonance, wisdom, charisma, intuition, adaptability, and vitality. The Planetary 12 are solar agency, lunar receptivity, mercurial velocity, venusian coherence, martial impetus, jovian expansion, saturnian structure, chironic adaptation, uranian surprisal, neptunian resonance, plutonic integration, and kinetic alignment.

Alchemical composition, elements, and canonical thermodynamics can inform the underlying stats through their existing derivation. They are not extra arbitrary bonuses added again to an overall that already includes their effects. ESMS token holdings remain economic inputs to seals, not substitutes for capability or experience. Character affinities are explicit numeric game attributes; prose traits do not become ratings through a text hash or sentiment guess.

The calculator accepts recorded stats on declared scales. The adapter rejects missing attributes instead of fabricating average scores. Natal DNA and current sky remain separately attributed. Placeholder/unattributed DNA yields no Current Overall; authored DNA or approximate/partial sky is explicitly estimated. Missing Chiron never invents a position and never removes its stat from the baseline.

## Experience policy, version 1

| Completed evidence                      |                                  Initial award |
| --------------------------------------- | ---------------------------------------------: |
| Chat exchange                           |                                         15 EXP |
| Verified imported training conversation |                                         25 EXP |
| Qualified ecosystem action              |                                         10 EXP |
| Achievement earned                      |                                        120 EXP |
| Settled Pentacles participation         |                                         10 EXP |
| Settled Pentacles victory               |                                        +65 EXP |
| Normalized positive ESMS winnings       | `min(40, floor(5 × log2(1 + winnings)))` bonus |

These weights can be tuned before rollout. Completion eligibility and repetitive-action qualification belong to each trusted producer; a click, text-length increase, token transfer, or client claim does not automatically qualify. Victory and settled participation are valued together once for a match, with a bounded winnings bonus. A loss never subtracts EXP.

Historical agents retain earned credit through verified training manifests. Existing authored conversation totals and seeded levels must be identified as legacy metadata, not silently relabeled verified training. Unknown prior history stays unknown until recovered; verified zero is a different state. User and agent receipts remain separate, even when one conversation legitimately grants experience to both participants.

## Readout

Show **Vessel Level**, lifetime EXP and next-level progress beside **Current Overall**. The detail reveals Base Overall, Vessel boost, Baseline Overall, signed chart adjustment, timestamp, and input provenance. For example: `Base 70 + Vessel 4 = Baseline 74; current chart −3 = Current Overall 71`. These numbers illustrate the relationship, not a measured player.

A sky outage leaves earned EXP and Vessel Level intact. Current Overall becomes unavailable or a visibly stale last-known snapshot. A source outage does not become zero experience. The current local adapters deliberately report missing experience until the persisted reader is connected.

The existing Sacred-only OWA `ovr` and seal contract remain compatibility fields while consumers adopt the new readout. Production pilot agents must resolve their own data rather than inheriting the fixed demo fixtures.
