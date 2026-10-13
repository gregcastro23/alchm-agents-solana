# Creator-scoped forge idempotency — 2026-10-13

Base: updated ASOL `origin/main` at `ca8825e`. Branch: `codex/idempotent-agent-forge`.

## Scope and starting evidence

The originating request referenced WTEN Phase 43, PR #933 (merged 2026-09-30,
`bfa1cdec`). WTEN Phase 44, merged PR #941 (`827f42dd`), subsequently removed
WTEN's unified creation endpoint and moved its Philosopher's Stone to an ASOL
handoff. WTEN's fetched master was `79025239`. The owner explicitly redirected
this implementation to ASOL during this session.

ASOL's active `/philosophers-stone` and `/forge` clients call `/api/create-agent`.
The starting route debited the payer, created `historical_agents`, provisioned
the account in a separate transaction with swallowed failures, then recorded
ownership without awaiting it. Every retry generated another agent ID. ASOL's
separate `/api/agents/unified` proxy and older creation endpoints have different
semantics and are outside this change's guarantee.

Inspected `CLAUDE.md`, `prisma/schema.prisma`, existing migration records, and
`.github/workflows/ci.yml`: schema deployment uses `prisma db push`; the older
migration history cannot reproduce the deployed schema. No WTEN JSON-profile
creator/request keys exist in this schema. A dedicated replay table avoids
inventing a mapping from legacy agent names or ownership blueprints to request
IDs. Historical agents without request IDs are not backfilled.

**Deployed rows remain unverified.** The ASOL checkout has no configured database
URL. The provided preflight was exercised against disposable local PostgreSQL,
not against a shared environment. No production schema or data was changed.

## Contract and atomicity

- Authenticated callers may supply a UUID `clientRequestId`. The server derives
  its creator from canonical authentication, ignoring any body-supplied identity.
  Both active pages use that same resolver, including kitchen-bridge identities.
- `(creatorId, clientRequestId)` is unique in `agent_creation_requests`. All
  validated request fields are hashed with SHA-256; schema ordering normalizes
  object key order, and unrecognized fields and the request ID are excluded.
  Changing a recognized field (including legacy specialty/notes) returns 409,
  even when that field does not currently affect generation.
- Same creator/key/input returns the complete original serialized success and
  agent ID with `deduplicated: true`. Changed valid input returns **409**. Invalid
  JSON or invalid consumed fields return **400 before any replay lookup**.
- Anonymous forging remains available without a key under the existing IP cap.
  An anonymous request supplying a key returns **401**. Requests without a key
  remain independent creations. Anonymous retry deduplication is not claimed.
- The claim, payer balance debit and transaction ledger, roster row, agent user,
  profile, agent balance, awaited ownership record, and saved response use one
  Prisma transaction. Any local failure rolls them all back, including the key.
  There is no compensating refund after a committed creation.
- A uniqueness loser reads the completed winner outside its aborted transaction,
  with a fresh database snapshot. It neither debits again nor syncs its discarded
  chart over the winning agent.
- Client request IDs survive network errors, rejections, and unreadable 2xx
  results. They change when the creator/input changes or success is confirmed.
  Unreadable 2xx is an uncertain result; prior good state stays visible. Replayed
  creation-time balances do not overwrite the client's current balance state.

Chart/blueprint generation remains outside the short database transaction and can
run concurrently more than once. Only one result can commit for a creator/key.
WTEN synchronization runs after local commit and remains best effort. There is
no durable outbox: process death or delivery failure can leave external sync
pending, and a replay does not retry delivery. This is a remaining integration
reliability task, separate from local creation atomicity.

## Schema-first rollout

Do this before deploying the keyed route/client changes:

1. Run `FORGE_PREFLIGHT_DATABASE_URL=... bun scripts/preflightAgentCreation.ts`
   against the intended environment. Review the aggregate existing-row audit;
   do not infer legacy keys or silently repair legacy ownership gaps.
2. Apply the additive `agent_creation_requests` table and its composite unique
   index. This repository normally uses reviewed `prisma db push` changes.
   The matching record migration is
   `prisma/migrations/20261013000000_add_agent_creation_requests/migration.sql`;
   if applying just that file, execute both statements in one transaction.
   Do not run old migration history to reconstruct a live environment and never
   use a real database as a Prisma shadow database.
3. Run `FORGE_PREFLIGHT_DATABASE_URL=... bun scripts/preflightAgentCreation.ts --require-ready`
   and verify the exact creator/request unique
   index is valid, with no duplicate or incomplete request records. Deploy only
   after the gate succeeds. Generate the Prisma client from the updated schema.
4. Deploy the route/client change. Missing table/column errors fail keyed
   requests closed with **503**, before debit or creation. Keep the table if
   rolling back application code; deleting replay records loses retry safety.

Production preflight, schema application, and deployment have **not** occurred.

## Acceptance evidence

PostgreSQL **16.14** ran on loopback in a disposable temporary database. Native
test binaries were isolated under `/private/tmp`; package SHA-512 integrity was
verified. No production URL was used. The schema was established from Prisma.

`test/forge-creation-postgres.spec.ts`: **8/8 passed**, calling the real production
transaction/provisioning/economy services with real Prisma clients:

| Scenario                                                              | Observed result                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Two independent sessions race on one creator/key                      | Both were observed blocked simultaneously at a database barrier; one ID, one complete local row set, one four-axis debit |
| Successful response discarded then retried                            | Same original ID and unchanged payer balance                                                                             |
| Same request key, different creators                                  | Independent agent IDs and one debit each                                                                                 |
| Same creator/key, changed input hash                                  | Conflict, no extra agent or debit                                                                                        |
| Failure injected at user, profile, agent balance, or ownership insert | Every prior local write and debit rolled back; same-key retry subsequently succeeded                                     |
| No client ID                                                          | Independent complete creations                                                                                           |

The hand-written migration was also executed in a separate empty PostgreSQL
database: its unique index was valid, duplicate creator/request insertion failed
with SQLSTATE `23505`, and a different creator could reuse the request ID.

The rollout readiness gate passed 23 PostgreSQL counterexamples/controls: it
rejects absent or malformed columns, misleading/nonunique/partial/expression/
widened/invalid indexes, incomplete rows, malformed saved response objects,
agent-ID mismatches, missing consciousness data, and nonfinite parsed numbers.
It uses the same success schema as replay, so an object-shaped payload alone
cannot pass readiness.

Real route tests use the production request validator and prove malformed input
cannot reach replay lookup, canonical creator scoping, early replay, 409/402/503
mapping, and winner-only postcommit synchronization. UI tests exercise bridge
identity, disabled controls when identity is unavailable, malformed 2xx retry
with the same body, and preservation of balance state.

The database scenarios are wired into CI's existing disposable PostgreSQL 16 job.
They require an explicit `FORGE_TEST_DATABASE_URL` and reject shared/non-loopback
databases. Without it, Vitest explicitly skips them.

## Checks and gate deltas

- Final full ASOL suite: **190 files passed, 2,202 tests passed; 4 files / 22 tests
  skipped**. The eight database scenarios ran and passed in this run.
- Typecheck: **0 errors**, matching the starting tree.
- Standard ESLint error gate: passed. New contract/client/request/test files also
  passed focused lint. Forced lint of the legacy route exposes existing ignored
  lint debt; no ignore configuration or lint baseline was changed.
- Both Monica/Kalchm formula gates: passed.
- Prisma schema validation and generation: passed.
- Existing raw SQL preparation gate: passed against local PostgreSQL, with its
  reported preexisting dynamic/DDL/missing-object coverage exclusions unchanged.
- Production build: **passed (exit 0)** after allowing network access for its
  configured Google Fonts. Existing dependency/native-binding warnings remain.
- `bun run verify:static` was invoked: ASOL has no script with that name. The
  relevant ASOL checks above were used. The originating WTEN run stopped at its
  existing deleted degree-route/generated duplicate-folder type errors; unrelated
  WTEN edits were preserved.

WTEN was not modified. Its actual starting working-tree scans read **95 domain /
89 wire optionality**, **71 production / 80 total bare JSON casts**, **0 opaque
predicate-less customs**, **2,711 single assertions**, and **0 scripts typecheck
errors**. These readings include preexisting local profile edits and a deleted
degree route; they are not a final merged-tree ratchet. The Phase 43 ceilings
were not reused, no debt campaign was repeated, and no baseline file was changed.
ASOL has no corresponding committed WTEN debt baselines to ratchet.

Standards and specification reviews found no remaining blocking issues after
fixing the readiness gate's initial weaker response check and correcting the
fingerprint-policy wording. Deployed data inspection and rollout remain the
explicit operational prerequisites above.
