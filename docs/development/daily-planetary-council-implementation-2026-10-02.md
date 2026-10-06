# Daily planetary council implementation

Implemented locally on October 2, 2026 from the planetary group chat audit. Both homepage surfaces now read one daily edition. Mobile responses use the card width below the speaker identity, desktop prose has a readable line-length limit, and anchor navigation leaves room for the sticky header. The implementation is not deployed, and no external database schema was changed.

## Reader experience

Gregory opens with the principal relationship and Sun placement, connects the planetary readings midway, and closes with a synthesis of two distinct earlier claims and two practical reflections. The outline covers all ten placements, lunar phase, known retrogrades, the principal aspects, the slower collective backdrop, and verified timed events when available. The opening leaves later lessons to their assigned speakers. A comparison with the preceding UTC opening snapshot explains changes when the two records have compatible provenance. When the source cannot establish event timing, the closing explicitly says that exact event timing is unavailable.

Placement agents combine their canonical CraftedAgent identities, beliefs, gifts and shadows with authored planet/sign knowledge, the existing degree-map themes, element, modality, ruler and dignity interpretations. Practical applications vary by planetary function as well as sign. Gregory receives relevant material from the existing poem corpus for voice inspiration and the accumulated claims from the whole conversation. Astronomy terminology is allowed and explained; private metrics and numerical coordinates stay outside dialogue.

The full conversation and compact preview share a read-only client store. Public reading never starts a model call. Verified events whose calculated times have passed appear in a separate “Updates since the opening” section without rewriting the opening conversation. An authenticated reader can explicitly ask a private, three-turn follow-up; the last turn belongs to Gregory. That question uses the entire exact displayed brief, including lunar phase, event times and confidence, and discloses its observation window. Private follow-ups are not added to the public edition or broadcast to a feed.

## Data and generation

- `sky-snapshot.ts` accepts Titlecase and lowercase keys through one adapter, preserves longitude/velocity/provenance, and rejects missing or invalid bodies. Missing planets never become Aries.
- `daily-sky.ts` anchors the edition at midnight UTC. Swiss Ephemeris is preferred; local Keplerian positions are explicitly approximate. Precise event claims require verified samples. Hourly samples and refinement identify ingresses, stations, lunar quarters and major aspect perfections. Sampling shares the cron deadline. Element summaries include all four categories, including zero counts; the same counts drive host context, fallback prose and ranking checks.
- `aspect-salience.ts` ranks verified perfections, lunar/personal rhythm, motion and orb instead of allowing a slow outer-planet aspect to dominate solely because its orb is smaller.
- `daily-episode.ts` plans a finite sequence and gives each speaker permitted evidence, placement knowledge and actual prior claims. Each beat has a strict output schema: evidence and coverage IDs are finite choices, and factual assertions must pair the exact server-authored statement with its matching evidence ID. Runtime validation separately checks coverage, recognizable contradictions, coordinates written as digits or words, repeated claims, unsupported reader natal attributions and guaranteed personal predictions. Applying conjunctions are distinguished from the later exact alignment. Shared event guards distinguish movement into a sign from movement through it, verify ingress destinations/station directions, and associate stated times with the correct event. Explicit uncertainty and denials remain distinct from affirmative claims.
- `daily-edition-review.ts` reviews the whole draft through typed factual, coverage and conversation issues. Short review IDs map back to the exact edition turns. Every turn remains eligible for factual and missing-topic correction; conversation issues apply only to model turns. Explicit opening, integration, planetary-reading and closing roles keep duties attached to the correct speaker. The editor reports up to four defective turns in conversation order. One repair pass addresses at most two flagged turns plus Gregory's closing, followed by a final review. A reviewed prefix without reported defects can survive a later rejected turn, with a factual remainder; an unavailable or invalid initial review yields a complete factual briefing. This model review is an additional check, not a mathematical proof of entailment.
- `daily-edition-schema.ts` validates the saved/public boundary, including every body's source and observation time, coordinate consistency, lunar/aspect consistency with those coordinates, the UTC window, event evidence, evidence-backed coverage and Gregory's opening/closing.
- `daily-edition-store.ts` uses an atomic lease and token-checked publication. Three attempts per version/day are allowed; expired ownership cannot publish. A completely deterministic result releases the lease for a later bounded retry instead of freezing an outage as the day's hosted edition.

Gregory's daily turns and the editor use the expert tier, routed to Gateway Claude Sonnet 4.6. Planetary delegates use the ambient tier, routed to Gateway Claude Haiku 4.5 for constrained generation. Native provider identifiers remain separate from Gateway catalog IDs, and direct-provider credential fallbacks are preserved. Provider retries are disabled because the council owns the bounded turn and repair budgets.

Generation defaults to a 210-second budget and is capped at 240 seconds or the caller's earlier deadline. A third of the available budget, capped at eighty seconds, is reserved for editorial work. Host turns receive twice a delegate's scheduling weight, with individual calls capped at twenty seconds for Gregory and twelve seconds for delegates. Editorial calls are capped at twenty-five seconds. The single repair pass uses the remaining weighted budget and reserves time for the final review. Expired calls abort and use factual readings.

Publication identity currently combines `daily-council-v3`, `educational-council-v3`, `western-symbolism-v2` and `routing-v2` in `council-version.ts`. Bump the appropriate version when changing those inputs. Snapshot IDs also incorporate source, actual positions, events and previous-day comparisons.

## Endpoints and operation

| Endpoint                                  | Purpose                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/agents/council-daily`           | Anonymous saved edition or current factual briefing; previous hosted edition remains available during a fallback.                 |
| `POST /api/agents/council-daily/question` | Authenticated explicit question, six requests per minute per caller per instance, three bounded turns, private/no-store response. |
| `GET/POST /api/cron/agents/council-daily` | Cron-authenticated generation under the existing heartbeat/deadline framework.                                                    |

The scheduled job checks at minute seven each hour and publishes only once per UTC day/version. Hourly invocations allow bounded retries after transient failures. Published editions remain immutable opening-snapshot readings; timed events within the day are provided in their factual overview and revealed as elapsed updates on subsequent reads. These updates reuse the edition's verified calculations; they do not claim a new live observation. A separate model-written intraday revision stream and proprietary degree-symbolism corpus are not implemented.

Public database reads share a two-second deadline before the independent factual briefing is used. Client reads have a twenty-second deadline, recover from stalled body reads as well as stalled requests, and ignore late results. Each reader of a shared opening-sky calculation has its own wait deadline; scheduled event sampling continues to obey its cron deadline.

Before enabling saved publication in an environment, apply the new `council_daily_editions` Prisma model using this repository's normal schema provisioning workflow. The migration SQL is a record of the change; the repository uses `prisma db push` for existing environments. Do not use an application database as a shadow database. Configure valid model-provider credentials, the Swiss Ephemeris endpoint, and the existing cron authentication secret in that environment.

## Verification and remaining limits

Automated coverage includes the actual sky input schema/context contract, complete/partial ephemeris samples, exact event searching and deadlines, immutable identity, adjacent-day comparison, lease ownership, public read separation, private question authentication, editorial rejection, placement knowledge, host scheduling, and both homepage views.

The current default suite passed 2,108 tests across 182 files, with 22 tests/four files skipped. See the [final review record](daily-planetary-council-review-2026-10-05.md) for the complete validation results, live dialogue assessment and remaining limits. The admin heartbeat rendering assertion follows the configured job count, including the new council job.

Commands:

```sh
bun run check
bunx vitest run
bun run scripts/smoke-test-persona.ts
bun run scripts/eval-daily-council.ts --date=2026-10-05
```

The October 5 production-build HTTP checks returned a schema-valid anonymous briefing with labelled approximate positions and rejected an unauthenticated private question with HTTP 401 after configuring a temporary local auth secret. The evaluation script writes reproducible Markdown and JSON reports to `/private/tmp` by default; use the final review record for current sample results.

A fresh provider credential now works for live generation. Run the opt-in evaluation without database writes:

```sh
bun run scripts/eval-daily-council.ts --date=2026-10-05 --live
```

Add `--trace` to retain generated draft dialogue and editorial diagnostics for inspection. Human review should assess factual fidelity, specificity, distinguishable voices, beginner learning, Gregory's curiosity/synthesis and whether successive claims add something. The evaluation sky remains explicitly approximate; the script does not certify astronomical accuracy. The final review record reports the live sample and browser validation results.

## Review follow-through

Standards review found deadline propagation, optional body provenance and version partitioning gaps; these were corrected. Spec review found a contradictory aspect-phase acceptance, truncated host history, absent day comparisons, missing prior hosted fallback and exact-string-only novelty checks; these were corrected. Subsequent review adds stricter snapshot/storage integrity, midnight boundary and shared-read regressions, bounded public reads, richer placement knowledge, targeted editorial repair, complete private-question context and elapsed event updates. Shared guards reject recognizable contradictory lunar phases, ingress destinations and event-time attribution in daily dialogue and private replies. The v3 pass adds constrained output metadata, role-aware editorial judgments, stronger public-sky and prediction boundaries, explicit unavailable-timing disclosure and weighted expert hosting. See the final review record for evidence of the resulting live voice quality.
