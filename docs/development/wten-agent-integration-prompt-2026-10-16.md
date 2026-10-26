# WTEN implementation prompt: reliable agent integration foundations

Paste the complete prompt below into a coding-agent chat rooted in the WTEN repository.

---

You are working in **WhatToEatNext / Alchm Kitchen (WTEN)**. Implement the receiver-side foundations that let **AlchmAgentsSolana / Planetary Agents (PA)** expand its MCP tools, recipe proposals, evidence reuse, and explicit menu publishing safely and reliably. Produce working code, migrations, contract documentation, and meaningful tests. Continue through implementation and verification; do not stop after presenting a plan.

## Scope and baseline

Work in WTEN. Preserve existing unrelated changes and follow its current `CLAUDE.md`, domain glossary (`CONTEXT.md`), ADRs, database migration conventions, and test safeguards. Inspect the current branch, working tree, and applicable instructions first. The checkout inspected for this handoff was WTEN `c5e8bef79a18b84ee433d1ce2b380f095c94411e` on 2026-10-16. Reconcile this brief with newer code rather than assuming those files remain unchanged. That checkout already contained modified/untracked Phase 45 handoff documents; preserve them.

PA has completed identity/session/privacy hardening and a recipe verification pass in commits `95db6fb` and `29ad25c` (PR #60 in `gregcastro23/alchm-agents-solana`). You may inspect the sibling PA checkout read-only if available, but this prompt is self-contained. Do not make PA changes part of this WTEN implementation. Record any required PA follow-up in a separate handoff document.

Established PA behavior:

- Verified identities, caller-bound chat sessions, private chat by default, and explicit publisher authorization protect externally visible writes. Menu planning returns drafts; an authorized publish action sends the exact reviewed draft with a stable delivery key.
- Catalog loading uses a bundled JSON snapshot. That historical snapshot contains 1,000 unique recipes, reports 1,099 total, and has 298 entries without nutrition. These are historical PA snapshot figures, **not current WTEN inventory measurements or targets to hard-code**.
- Unknown explicit recipe IDs fail instead of selecting another recipe. Menus require 28 unique day/meal slots and supplied catalog IDs; saved menus are checked before reuse.
- Generated recipe proposals carry substitutions and `instructionReviewRequired: true`; their inherited nutrition/dietary claims are removed. Their instructions, methods, and timings have not received culinary verification. A catalog ID does not prove that a generated adaptation is valid.
- Feed publication, local comment persistence, and remote comment persistence are reported separately. PA does not assume successful feed delivery proves a remote recipe comment was saved.
- The recipe path still sends an explicit numeric rating, commonly defaulting to five. This is agent-generated commentary, not a human cooking assessment. Omitted `madeIt` / `made_it` means no cooking attestation.

WTEN already has a stronger **saved-adaptation** workflow. Preserve it:

- The canonical adaptation route authenticates a requester and currently supports the Leonardo da Vinci vegetarian pilot with UUID `clientRequestId`.
- It binds the saved version to authoritative source content, actual stored agent chart/preferences, validated ingredient/instruction changes, a verification receipt, and explicitly unavailable recalculated readings.
- Generic `/api/feed` ingestion rejects `recipe_adapted` and reserved `source`/`kind: saved-adaptation` payloads. Generic recipe storage also protects this provenance.
- Existing mirroring avoids inventing omitted ratings or cooked flags; `catalog_critique` does not overwrite an existing explicit interaction.
- Chat events are excluded from the public feed. Keep that boundary.

Do not replace these guarantees with PA's looser generated proposal format. Extend existing services and test seams; avoid parallel persistence stacks, duplicate MCP servers, or a broad SDK migration.

## Required outcomes, in implementation order

### 1. Define shared publication contracts and truthful receipts

Inspect the feed route and `feedDatabaseService` before editing. Today `createEvent(): Promise<boolean>` can confirm a feed insert while the separately attempted recipe-interaction mirror fails. The feed route returns only `success`, `agentEmail`, and `eventType`.

Introduce a typed detailed publication result, keeping a compatible boolean wrapper for existing callers where appropriate. Return actual persisted identifiers and distinct outcomes for feed, recipe reflection/comment, menu, and any legacy interaction projection. Use schema validation and contract tests; do not infer database outcomes from HTTP status or fabricate IDs.

Preserve the existing feed fields and add a receipt shaped like this confirmed example. Current PA directly reads `success`, `event.id`, and the top-level boolean `recipeCommentSaved`; additional receipt fields support reconciliation and future clients:

```json
{
  "success": true,
  "agentEmail": "leonardo-da-vinci@agentic.alchm.kitchen",
  "eventType": "recipe_generation",
  "deliveryId": "the-request-delivery-key",
  "event": { "id": "the-actual-persisted-feed-row-id" },
  "feedPublished": true,
  "recipeCommentSaved": true
}
```

The values above illustrate a fully confirmed outcome, not defaults. `recipeCommentSaved: true` must identify a durably stored recipe-linked commentary record retrievable through the documented recipe history contract. Include its stable ID in a richer receipt. A protected no-op against `user_recipe_interactions` is not a newly saved comment; represent that projection separately. `false` means the requested comment has not been saved. Omit the boolean when its persistence is genuinely unknown, with an explicit detailed state explaining why. Distinguish `not_requested`, `pending`, `saved`, `failed`, and `unknown` as applicable rather than collapsing them.

**Compatibility matters:** the current PA feed sender interprets HTTP success plus `success: true` as a committed feed write. Therefore do not return that combination for a merely queued feed job. The feed must already be durable, or the legacy-compatible response must remain unsuccessful/unconfirmed. A durable feed with a pending/failed comment can report the feed success and separate comment outcome accurately.

Persist enough receipt state to survive a process restart and lost acknowledgement. Document whether duplicate delivery replays the original acceptance receipt or a monotonically updated receipt; resource IDs must remain stable, and a separate reconciliation read must expose current outcomes. Define a schema/contract version and structured error codes. Never label the whole operation atomic unless the relevant writes actually share one transaction.

### 2. Make feed and weekly-menu publication independently idempotent

Reuse the existing `webhook_events` inbox, signature helpers, and database transaction facilities where suitable. Audit their failure behavior: the generic inbox can continue processing when recording fails, reclaim failed/stale claims, and swallow completion errors. An inbox claim alone does not prevent a second feed insert after the first insert commits but receipt completion fails.

For the agent publication paths, establish a durable publication identity scoped to the authenticated integration principal, operation, and caller delivery key. If a shared bearer currently identifies just one trusted integration principal, state that limitation; an unverified source/header/body value cannot create a new principal. Bind publication identity to a deterministic fingerprint of the **validated semantic payload**, including canonical actor, recipe/menu target, week where applicable, exact proposal/menu contents, and publication options. Exclude transient transport headers and signatures. Persist bounded parsed public content and necessary digests, not secrets or raw request/session dumps.

Required behavior:

- First valid delivery produces one logical publication and receipt.
- Same scoped key and same semantic payload replays/reconciles the same publication; do not re-run generation or duplicate side effects.
- Same scoped key with changed semantic payload returns 409 with a distinct payload-conflict code before additional writes.
- Different principals cannot read or replay one another's receipts. A principal/body actor mismatch cannot grant another user's permissions.
- Concurrent deliveries, stale workers, process crashes, acknowledgement loss, and receipt-write failure do not duplicate feed entries, recipe reflections, menu versions, or notifications.
- Resolve conflicting header/body delivery keys explicitly. Accept the header-only keys sent by PA's current menu client. Do not silently truncate a key and create collisions; document compatible bounded limits.
- Preserve PA/ASOL's existing retry marker: in-flight delivery uses HTTP 409, body `status: "in_flight"`, and `Retry-After: 1`. A payload conflict must not use the in-flight marker.
- If the publication reservation cannot be recorded, either the independently unique/transactional resource path still proves safe, or fail closed before externally visible side effects. Do not globally change Stripe/Vercel webhook behavior as collateral work.

Prefer a single transaction for publication identity, feed/reflection/menu writes, and receipt where practical. Use the same database client throughout the transaction; standalone pool queries do not join it automatically. For asynchronous projection, notifications, or reconciliation, use a durable transactional outbox and existing worker facilities, with bounded retries and explicit outcomes. Do not add an in-memory-only background task and call it durable. Replays must not repeat rewards or billing.

Add an authenticated, actor-scoped receipt lookup by delivery/operation ID, using existing route conventions. It must return real resource IDs and each outcome; lookup is read-only. Support narrowly authorized reconciliation of partial outcomes without creating another feed row. If a worker is required, wire its real scheduling/heartbeat/alerting path and test it. Keep generation and public posting out of GET/preview paths.

#### Weekly-menu specifics

Harden `POST /api/menu-planner/agent-weekly-menu`. It currently upserts a menu, accepts loosely typed slots, and can append another feed event on replay; an `idempotencyKey` in feed metadata is not deduplication.

For completed menus being published, enforce:

- Canonical agent identity, authoritative recipe references, and Sunday at midnight UTC for `weekStartDate`.
- Exactly 28 slots: integer days 0–6 crossed with breakfast/lunch/dinner/snack exactly once; bounded positive servings; featured meals reference the recipe assigned to their slot.
- Source recipe facts remain server-owned. PA may submit proposed ingredient/name changes linked to a real base recipe; preserve them as clearly unverified proposal data instead of falsely promoting them to canonical recipe facts or rejecting all adaptations merely because their display name changed.
- Missing/unknown recipes and forged reserved adaptation provenance fail before publication. Do not quietly substitute another dish.
- Draft/save-only flows remain compatible and never publish. Do not impose complete-week publication rules indiscriminately on legitimate partial draft callers. Specify how invalid combinations such as draft plus `shareToFeed: true` are handled.
- Same key reuses the original menu revision and feed event. A deliberately revised menu under a new key follows a documented revision policy; old receipts continue to refer to their original version and content, even if the latest agent/week projection changes.

Keep the two key namespaces distinct: PA derives its outbound menu delivery ID as `stableEventId('weekly-menu-publication', actor.id, callerKey)`. WTEN receives that derived outbound ID in the `Idempotency-Key` header, not the raw PA caller key. WTEN must use the received ID; PA must reconcile using the original outbound ID already stored in its ledger, while retaining the caller's original key at PA's boundary.

Keep PA's existing response fields (`success`, `agentEmail`, `userId`, `menu.id`, `feedShared`) and add richer receipts. **When feed publication was requested, `success: true` must require the requested feed write to be confirmed.** The current PA menu client accepts `success: true` plus `menu.id`; a saved menu with a failed/unconfirmed feed write must not masquerade as a completed publication. Return an unsuccessful/unconfirmed response with the real menu outcome and a reconcilable receipt. Save-only success can correctly have `feedShared: false`.

WTEN deliberately strips flat model-generated menu `nutritionalTotals`; preserve that decision. Neither a submitted total nor a proposed recipe's nutrition becomes authoritative through menu persistence.

### 3. Persist generated recipe reflections without corrupting cooking records

`user_recipe_interactions` has one row per actor/recipe. It is a latest-interaction projection, not append-only commentary history. PA `source: recipe_alteration` currently falls outside the special `catalog_critique` overwrite protection.

Add or extend a durable, typed recipe-reflection/comment record with stable ID, canonical recipe ID, authenticated author/agent identity, originating feed/publication ID, source, content state, public text, proposal/substitution provenance, and timestamps. Reuse existing comment infrastructure if it represents these invariants; otherwise add the smallest appropriate table and migration. Use unique publication identity to prevent replay duplicates.

Generated proposals must:

- Preserve existing human ratings, reviews, and cooked attestations. Generated numeric scores must not become trusted human ratings or a five-star cooking record. If retained, classify them as agent commentary scores and exclude them from human rating aggregates and rewards.
- Remain explicitly `proposed` / review-required; link to the original canonical recipe. Preserve `instructionReviewRequired` and unavailable nutrition/dietary/readings rather than inventing verification.
- Not create a canonical saved-adaptation URL, validation receipt, completed cooking event, or trusted dietary claim from arbitrary `recipePayload` metadata.
- Preserve deliberate explicit human interaction updates through their authenticated existing pathways. Do not globally suppress legitimate human ratings to solve generated-content handling.

Provide cursor/keyset-paginated recipe history with stable ordering (timestamp plus unique ID), source and author type, limit/next cursor, and truthful source/coverage metadata. Filter by recipe and visibility **before** pagination. Apply the project's existing authentication, two-way block, moderation, sanitization, deletion/visibility, and rate-limit policies. Reuse the feed-comments policy seams; generated writes must not create a moderation bypass.

Keep `/api/recipes/[recipeId]/community-tips` as the existing top-rated projection for compatibility. It currently returns at most ten reviews rated at least four and hides query failure as HTTP 200 `{tips: []}`. Preserve valid response fields while distinguishing a healthy empty result from unavailable data, and ensure existing consumers handle the explicit failure/degraded result. Do not rename that projection to “all comments.”

### 4. Export a complete, versioned, source-grounded recipe catalog

Keep the current UI recipe listing contract compatible. Add a dedicated machine-consumable export/snapshot contract using WTEN conventions; select and document the endpoint names.

Requirements:

- Canonical stable recipe IDs and deterministic unique ordering, independent of popularity fluctuations. Reuse the identity/ref resolver and authored-facts normalization so static/live aliases resolve consistently and placeholder facts do not reappear.
- A schema version, immutable snapshot/revision identity or equivalent consistent read, deterministic content digest, export time, source/provenance, actual total count, bounded page size, next cursor, and explicit completion semantics.
- Multi-page retrieval must stay on one consistent snapshot. A changed/expired snapshot must explicitly require a restart; do not mix mutable offset pages and claim a complete export. Repeated pages, equal sort keys, deleted/new recipes, and stale/tampered cursors must be deterministic or fail explicitly.
- Represent live/database, genuine static snapshot, and degraded source states honestly. An unavailable authoritative source cannot silently become a fabricated catalog or healthy empty result. Validate Hono proxy responses too; successful proxy HTTP status is insufficient.
- Measure valid-recipe count and nutrition coverage against the actual authorized local/test source, identifying that source. Deployed counts remain unknown unless separately verified through authorized reads. Do not hard-code 1,099/298 or assert complete nutrition coverage because the export completed.
- Specify the digest algorithm, canonical serialization, and verification vectors so another client can independently validate the export. Include content hashes and useful source versions/timestamps for recipes so PA can pin evidence and invalidate stale proposals. Unknown source revision/freshness remains unknown; `exportedAt` is not proof that source content was freshly updated.
- Preserve authored facts and existing unknown values. Nutrition must identify its basis, serving/whole-recipe units, known servings, source/calculation version, coverage, and availability. Partial totals remain labeled lower bounds. Unknown mass must not become guessed 50 g portions or zero nutrition.
- Reuse `nutritionCompleteness` and menu nutrition-coverage rules. Edited ingredients invalidate inherited nutrition, allergens/dietary claims, and other derived readings until a real recalculation validates them. Preserve known ingredient evidence, but unknown status must never imply zero nutrition, allergen-free, or verified diet compatibility. Preserve the domain distinction between elements (Fire/Water/Earth/Air) and quantities (ESMS); do not synthesize ingredient ESMS from elements.

Ship a documented verifier/example that walks every page, checks schema, pinned snapshot, unique IDs, counts and digest, and publishes a replacement artifact atomically only after full validation. Demonstrate it against disposable/local data containing more than 1,000 recipes. This is an export and verification foundation; updating PA's committed snapshot/import workflow is a separate handoff item.

### 5. Provide a stable integration surface for future MCP functionality

Document machine-readable request/response schemas and supported capabilities for the APIs above, using the repository's existing OpenAPI/schema conventions if present. Include contract version, supported operations, limits, provenance fields, receipt states, publication/retry rules, and explicitly unsupported features. Capability claims must correspond to implemented, tested handlers.

Use existing observability to correlate PA delivery/correlation IDs through WTEN publication, reflection, menu, and outbox processing. Record actual outcomes, latency, retry/reconciliation state, and source freshness without logging credentials, private chat history, or full private prompts. Extend existing operator metrics/heartbeats for any new durable worker instead of adding a separate dashboard project.

Keep all reserved saved-adaptation checks and regression tests. A future trusted PA route may call the canonical adaptation service only through an explicit authenticated authorization policy and the same authoritative-source, chart/preferences, instruction-edit, verification, and persistence gates. **Do not silently enable arbitrary agents/modes or turn a generated proposal into a verified adaptation.** Deliver a concise extension plan naming which verification evidence and caller identity binding would be required to expand beyond the current pilot. A documented supported boundary is preferable to a placeholder endpoint that claims broader functionality.

## Authentication and compatibility rules

- `/api/feed` and the weekly-menu bridge currently authenticate with Bearer `INTERNAL_API_SECRET`. `ALCHM_KITCHEN_SYNC_SECRET` guards other integration routes; do not treat the secrets as interchangeable.
- Reuse `safeEqual` / `bearerMatches` and the current Standard Webhooks verification/rollout policy. Do not introduce raw secret equality or disable signature checks to make integration tests pass.
- Derive requester permissions from verified authentication, not supplied user IDs, roles, email strings, or agent charts. Preserve legitimate agent provisioning and its 422 chart-classification refusal.
- Keep the existing 16 KB feed-metadata boundary unless a measured, documented bounded-reference design is needed. Avoid blindly raising it to accept whole recipes. Specify what PA must send when a proposal exceeds the limit; reject before side effects and return a usable error.
- Preserve existing legacy field meanings. Version genuinely incompatible semantics instead of silently switching them. Use real current PA-shaped fixtures, including header-only menu keys and `recipe_generation` / `source: recipe_alteration` events.
- Never restore private chat excerpts or feed emission to satisfy observability or activity counts.

## Code and test starting points

Inspect current files; these paths were verified at the baseline:

- `src/app/api/feed/route.ts` and `src/services/feedDatabaseService.ts`.
- `src/lib/hooks/{idempotency,inbox,standardWebhooks,secureCompare}.ts` and `src/lib/database/connection.ts`.
- `src/app/api/menu-planner/agent-weekly-menu/route.ts`, `src/services/menuPersistenceService.ts`, `src/services/menuPersistenceQueries.ts`, and `src/lib/validation/apiSchemas.ts`.
- `src/app/api/recipes/route.ts`, `src/services/LocalRecipeService.ts`, `src/lib/recipes/{recipeRefResolver,recipeIdentity}.ts`, and `src/lib/search/authoredFacts.ts`.
- `src/app/api/recipes/[recipeId]/community-tips/route.ts` and `src/app/api/feed/comments/route.ts`.
- `src/app/api/recipes/[recipeId]/adapt/route.ts` and `src/lib/recipes/{savedAdaptationSchemas,savedAdaptationService,savedAdaptationPersistence}.ts`.
- `src/utils/nutritionCompleteness.ts` and `src/utils/menuPlanner/nutritionCoverage.ts`.
- Existing feed auth/idempotency tests; weekly-menu route tests; `feedDatabaseService.mirror.test.ts` and `.mirror.postgres.test.ts`; saved-adaptation service/route/PostgreSQL tests; authored-facts and nutrition-coverage tests.

## Acceptance tests and evidence

Prefer route/service integration tests at existing boundaries. Use real disposable PostgreSQL tests for uniqueness, transaction rollback, concurrency, restart/replay, foreign keys, and receipt durability; mocks alone cannot establish those guarantees. Reuse the repository's explicit disposable-loopback `phase45_test*` database safeguards and migration-test conventions. Production credentials/databases are not test or shadow resources.

At minimum demonstrate:

1. Current PA feed payload returns real feed/reflection identifiers and accurate outcomes; feed-only success, absent commentary, protected projection no-op, and failed/unknown commentary are distinguished.
2. Generated `recipe_alteration` cannot overwrite a pre-existing human review/rating/cooked record or contaminate human rating aggregates. Omitted cooking claims remain absent/false; omitted scores remain unknown.
3. First delivery, identical replay, concurrent replay, changed-payload conflict, header/body conflict, and another principal's lookup all behave correctly. Side effects occur once.
4. Failure after a feed/menu/reflection commit but before receipt completion and a lost HTTP acknowledgement are recoverable after a fresh process/client. Reconciliation repairs only missing outcomes.
5. Reservation/inbox failure, outbox retry, notification failure, worker restart, and duplicate delivery neither create duplicate resources nor falsely report a complete result.
6. Weekly-menu tests cover 28 valid slots, duplicate/missing/fractional days, unknown recipes, inconsistent featured entries, UTC week normalization, valid partial drafts, no draft publication, revised-menu versioning, and requested feed failure after menu persistence.
7. Every reserved saved-adaptation rejection, authoritative-basis verification, immutable saved-version replay, unsupported-agent/mode rejection, and unavailable-readings guarantee remains intact.
8. Recipe history is append-only and paginated by canonical recipe/visibility before limits. Multiple comments by one actor remain individually addressable. Blocks, moderation, deletion, empty history, and source outage remain distinguishable.
9. More than 1,000 recipes export completely without duplicates/omissions. Equal sort keys, concurrent catalog changes, deleted entries, invalid/expired cursors, proxy-invalid payloads, degraded sources, and interrupted refreshes cannot produce a falsely complete artifact.
10. Canonical aliases and authored facts survive export; missing/partial nutrition, unknown weights, changed ingredient quantities, and stale derived readings remain truthful.
11. Unauthorized/forged actor requests, bad signatures, oversized payloads, private chat events, and invalid references fail or are excluded before public side effects. Existing browser/user behavior and legitimate human interaction updates retain their tests.
12. Contract fixtures parse in the shapes current PA consumes; receipt fields are not renamed away, unknown is not converted into success, and the receipt read/reconcile APIs are scoped correctly.

Run the repository's appropriate Bun checks, including targeted tests and the configured typecheck/build/verify gates where feasible (`bun run test`, `bun run typecheck`, `bun run build`, `bun run verify` per current guidance). Run required checks once the final relevant changes are integrated; report exact commands/results. If an existing unrelated failure or unavailable disposable database blocks a gate, identify it precisely, keep unaffected verification moving, and do not claim that gate passed. Do not lower ratchets or skip assertions merely to obtain green output.

## Deliverables and completion report

Deliver cohesive reviewable WTEN changes, with migrations and a local verification/rollback plan, typed contracts, compatibility fixtures, and the tests above. Do not deploy, execute production migrations, rewrite production history, register external webhooks, or modify the PA repository as part of this task.

Add a WTEN integration contract document and a PA handoff document containing:

- Exact endpoint paths, versions, authentication, request/response examples, receipt states, idempotency/fingerprint rules, and error/retry semantics.
- How PA should export/verify/atomically refresh its snapshot and handle missing nutrition/provenance.
- How PA should consume confirmed feed/comment outcomes, switch from top-rated tips to the new history contract, and reconcile weekly-menu uncertainty using the **same original outbound delivery/event ID stored in the PA ledger**. The caller-facing PA key remains unchanged at PA; it is not WTEN's lookup key. Do not recompute an outbound ID under a different actor or replace it with a new key.
- The precise evidence required before PA may change its weekly-menu policy from one bounded attempt to safe retries. The existing PA ledger currently preserves uncertain outcomes; a receipt endpoint alone does not update that sender automatically.
- Which capabilities are implemented and which remain proposals, including validated-adaptation expansion. Include migration/rollout ordering that keeps the current PA sender working.

Conclude with implemented behavior, commit identifiers if created, exact tests/checks and their scope, migration instructions, remaining material limits, and the PA-side follow-up. Do not claim “all hallucinations eliminated,” “exactly once,” “atomic,” “complete catalog,” “verified nutrition,” or “comment saved” beyond the evidence and guarantees actually implemented.
