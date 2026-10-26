# Vessel progression: integration and rollout

Status: implementation plan. The pure progression/experience calculations are a foundation; this document does **not** claim that durable XP, cross-site awards, historical backfills, or production rollout are implemented.

## Implemented locally

- Versioned, deterministic 19-stat progression and receipt-based EXP calculations, including replay and duplicate outcome protection.
- Strict stat/natal adapters, a timestamp-preserving approximate sky provider, and an agent progression read model. Recorded EXP and baseline survive unavailable chart data.
- Nullable progression fields in the agent ratings and Vessel summary contracts. The ratings endpoint now resolves pilot agents from the real catalog rather than fixed demo payloads. Without an explicit ledger, agents with recorded catalog conversation counts derive deterministic training progression (25 XP/conversation); subjects with no record explicitly remain unavailable.
- A shared Sacred stat vocabulary without presentation/fixture dependencies. Existing Sacred-only OWA, seal, currency, and evolution behavior remains compatible.

Validation: 68 focused Bun tests and 22 Vessel summary Vitest tests pass; a focused TypeScript check passes for the changed core, adapters, rating contract, and agent rating route. The summary suite used an isolated Node test configuration because the normal shared setup is a cloud-only file in this checkout. Its live Pentacles configuration is mocked; these tests do not verify cross-site delivery or durable database concurrency. Full-repository validation remains limited by unavailable cloud-only files. The illustrative interactive example also passes a DOM interaction check for permanent growth and chart-only fluctuations.

## Product contract

- **Vessel Level** comes from permanent accumulated Alchm EXP. Earned EXP and Vessel Level do not fall when the sky changes, a source is unavailable, a wallet changes, or chat text is deleted.
- **Baseline Overall** combines all seven Sacred stats and all twelve Planetary stats, then receives an additive Vessel Level boost.
- **Current Overall** transforms that baseline using the subject's natal chart (DNA), character affinities, and the current sky. It can be above or below baseline without consuming EXP.
- Users and agents have separate progression subjects. An agent's training history belongs to that agent; an owner's unrelated activity must not silently increase every owned agent's level.
- Existing stage, evolution, currency, and legacy level fields retain their meanings during migration. Do not relabel them as verified Vessel progression.

The initial pure calculation in `lib/vessel/progression.ts` uses `min(100, 1 + floor(sqrt(EXP / 100)))`, a maximum +12 baseline boost, and a bounded sky adjustment of ±8. EXP continues accumulating at level 100. These are versioned game balance choices, not measured properties of people. Baseline/current values are bounded by the rating scale; increases can saturate at its ceiling.

## Existing integration points and gaps

`lib/vessel/summary.ts` already combines the Kitchen ledger, local Agents arena records, Pentacles data through a verified wallet, and source health. Keep this aggregation and its authentication boundary in `app/api/vessel/summary/route.ts`. The summary now accepts an optional supplied progression snapshot and otherwise returns `null`; a production progression reader still needs to be connected.

This aggregation is not a permanent experience ledger. Current balances are spendable assets; recent ledger entries and current counters cannot reconstruct lifetime EXP. A missing source is unknown, not zero earned experience. Agents Jing records do not currently establish a winner, so completion must not be described or rewarded as a win.

Historical metadata and catalog records contain seeded conversation counters. Under the canonical progression policy, catalog agents with recorded conversations derive baseline training EXP (25 XP/conversation under `training.imported`) with deterministic manifest digests when an explicit runtime ledger is omitted. For live runtime chats, `AgentConversation` retains exchange records, but `app/api/cron/purge-guest-chats/route.ts` removes guest conversations after 30 days. Durable live awards must survive eligible source-text deletion without retaining the text itself.

The current `awardXp` path in `lib/historical-agents-db.ts` needs an idempotent event boundary before it can be an authoritative Vessel EXP writer. Pure reducers validate/replay supplied records; they do not establish source authenticity, persist receipts, or provide database concurrency control.

## Durable award model

Introduce a server-owned `VesselExperienceReceipt` and a materialized `VesselProgressionAccount` in a schema migration.

| Field                           | Required meaning                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `subjectType`, `subjectId`      | `user` with canonical authenticated `privyDid`, or `agent` with stable canonical agent ID |
| `origin`, `originEventId`       | Owning producer and durable domain-event ID; forwarded/mirrored copies preserve both      |
| `actionType`, `occurredAt`      | Verified action and completion time, independent of delivery time                         |
| `xp`, `policyVersion`           | Accepted nonnegative integer award and the policy that valued it                          |
| `evidenceRef`, `evidenceDigest` | Minimal source reference/integrity metadata; never raw private chat content               |
| `acceptedAt`, `importBatchId`   | Audit time and optional approved historical import provenance                             |

Enforce a database unique constraint on `(subjectType, subjectId, origin, originEventId)`. A policy version is **not** part of this identity: upgrading weights or replaying an event must not award it twice. Where one event contains multiple independently eligible actions, assign stable canonical action IDs at its producer.

Resolve identity on trusted servers. Do not accept arbitrary subject IDs, XP amounts, wallet claims, or source provenance from a browser. Map verified wallets and site identities to the stable user subject; wallet rotation/relinking changes source lookup, not the progression account. Keep anonymous activity unclaimed until a supported authenticated attribution proves ownership.

Insert the receipt and increment the account total in one database transaction; duplicate inserts are no-ops. Concurrent requests must not overwrite the total with a stale read. Store totals in an integer representation with an explicit API serialization limit and reject overflow instead of silently losing precision.

Use a transactional outbox at each producer so an awarded local action and its outgoing event commit together. Consumers acknowledge only after the receipt/account transaction commits. Retries and reconciliation replay the same event IDs. An in-memory reducer or request-time sum is not a substitute for this persistence.

Once awarded, EXP is append-only. Failed, rolled-back, or disputed source events are ineligible until finalized; do not automatically subtract accepted EXP later. Exceptional administrative corrections require a separate reviewed policy and audit trail.

## Source adapters

Maintain one versioned policy registry covering every supported site action. Enumerate action producers across Agents, Kitchen, Pentacles, and other connected sites before claiming full ecosystem coverage; unsupported actions report pending support.

| Source                                | Eligible durable evidence                                                                | Deduplication / interpretation                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Agent and user chats                  | Persisted completed exchange or accepted training interaction ID                         | One action award per eligible exchange, not every stream chunk, retry, or model token        |
| Historical agent training             | Reviewed training manifest with corpus/run identity, item count, digest, and attribution | Explicit disjoint coverage from live chat receipts; rerunning an import cannot add EXP       |
| Kitchen achievements/quests/creations | Canonical completion/unlock event ID from Kitchen                                        | Reward-claim entries and mirrored ledger credits refer to the same originating action        |
| Agents Jing and Word activities       | Completed round/move IDs with documented eligibility                                     | Completion and verified victory are separate actions; absent winner data never implies a win |
| Pentacles winnings                    | Final authoritative match/settlement IDs and verified participant identity               | Kitchen reward mirrors and Pentacles settlement share a canonical origin; award once         |
| Other site actions                    | Server-confirmed action IDs with explicit completion and policy rules                    | Register the adapter and its tests before enabling awards                                    |

Balances, transfers, deposits, market-price changes, staking principal, and unfinalized winnings are not earned EXP. If winnings magnitude affects an award, define canonical units, bounded conversion, settlement status, and replay behavior in the versioned policy; never use a changing wallet balance. Receipt category labels should expose what earned the EXP.

## Authentic rating inputs

Resolve all 19 canonical stats with their scale and provenance. A missing stat is unavailable; a synthetic filler number must not become a claimed live rating. Normalize the Sacred and Planetary scales before combining the two families.

Resolve the subject's own attributed natal DNA and character primary/secondary affinities. Authored fictional DNA may support an explicitly estimated rating; placeholder/unattributed charts do not establish a live one. Agent ownership is not a reason to substitute the owner's chart.

Use one sourced sky snapshot with an observation timestamp for each computation. Reuse the repository's ephemeris path and preserve approximation/provenance. The pure engine rejects stale/unverified sky data and reports partial coverage. Recompute Current Overall when the sky refreshes, relevant stats/DNA/character changes, or permanent EXP changes. No sky job writes EXP.

Expose `currentOverall: null` and explanatory status when essential inputs are missing. Retain known baseline and permanent progression independently. A source outage preserves the last committed EXP and flags delayed synchronization; a new/unmigrated account is unknown until initialized, not a fabricated level-one account.

## Staged rollout

1. **Contract and evidence inventory.** Document canonical subject mapping, all action producers, receipt identities, policy weights, and historical corpus coverage. Audit seeded counters and distinguish verified, authored, legacy, and unknown data. Keep new production ratings disabled until their inputs meet the contract.
2. **Durable core.** Add account/receipt/outbox migrations and a single authenticated ingestion service. Connect the pure reducer and progression calculation through server adapters. Test transactional idempotency and concurrent awards against a real test database.
3. **Live adapters in shadow mode.** Wire chats/training, achievements/quests, Agents activities, and Pentacles settlements. Record receipts without replacing legacy displays. Reconcile producer totals, outbox backlog, duplicate counts, and rejected evidence; explicitly account for unsupported action types.
4. **Historical migration.** Dry-run verified manifests and retained event history into a report per subject. Define a cutover watermark and non-overlapping source ranges so backfill and live delivery can run together safely. Seeded catalog conversation totals serve as the initial training import baseline until replaced by itemized historical transaction receipts.
5. **Backfill and reconciliation.** Apply approved deterministic batches with stable IDs, digest checks, and restartable checkpoints. Preserve receipt metadata when chat bodies expire. Compare persisted totals with a full receipt replay; retain legacy fields for comparison and rollback.
6. **API and UI.** Extend the Vessel summary with an optional, versioned progression object and independent experience/rating source status. Keep old currency/stream fields compatible. Show Vessel Level, lifetime EXP/next-level progress, Baseline Overall, Current Overall, signed sky delta, observation time, and unavailable states. Use the same calculation for users and agents.
7. **Enable progressively.** Start with verified subjects/sources, monitor discrepancies and source lag, then expand. Roll back display selection or pause ingestion if needed; preserve accepted receipts and outbox events for repair/replay. Do not silently rerate historical receipts when balance weights change.

## Acceptance gates

- Repeated, concurrent, mirrored, reordered, and post-policy-upgrade delivery of one action grants EXP once; legitimate distinct actions each count.
- Source downtime, deleted guest chat text, wallet rotation, sky changes, and replay cannot decrease persisted EXP or Vessel Level.
- User and agent subjects stay isolated; forged subject IDs, arbitrary XP, unverified wallet links, invalid numbers, and unknown policies are rejected.
- Backfill reruns are stable, historical/live coverage cannot overlap, and catalog conversation counts cleanly map to deterministic `training.imported` manifests at 25 XP per exchange.
- Every one of the 19 stats can affect baseline; character and natal/current geometry affect the sky response; favorable and adverse fixtures move Current Overall above and below baseline away from scale boundaries.
- Increasing accepted EXP never lowers the level or trained baseline. Sky-only changes leave EXP, level, and baseline unchanged. Level-100 EXP still accumulates.
- Missing/stale/approximate chart or sky inputs produce truthful status and nullable values; outages never fabricate baseline 65 or substitute zero lifetime EXP.
- Existing summary consumers keep rendering balances/streams; the new UI distinguishes permanent growth from changing Current Overall and shows source freshness.
- Production cutover requires passing persistence, identity, producer-adapter, backfill, and UI checks—not only pure-function tests.
