# Daily planetary council implementation

Implemented locally on October 2, 2026 from the planetary group chat audit. Both homepage surfaces now read one daily edition. The implementation is not deployed, and no external database schema was changed.

## Reader experience

Gregory opens the conversation, connects the planetary readings midway, and closes with a synthesis. The outline covers all ten placements, lunar phase, known retrogrades, the principal aspects, the slower collective backdrop, and verified timed events when available. A comparison with the preceding UTC opening snapshot explains changes when the two records have compatible provenance.

Placement agents combine their canonical CraftedAgent identities, beliefs, gifts and shadows with authored planet/sign knowledge, the existing degree-map themes, element, modality, ruler and dignity interpretations. Practical applications vary by planetary function as well as sign. Gregory receives relevant material from the existing poem corpus for voice inspiration and the accumulated claims from the whole conversation. Astronomy terminology is allowed and explained; private metrics and numerical coordinates stay outside dialogue.

The full conversation and compact preview share a read-only client store. Public reading never starts a model call. Verified events whose calculated times have passed appear in a separate “Updates since the opening” section without rewriting the opening conversation. An authenticated reader can explicitly ask a private, three-turn follow-up; the last turn belongs to Gregory. That question uses the entire exact displayed brief, including lunar phase, event times and confidence, and discloses its observation window. Private follow-ups are not added to the public edition or broadcast to a feed.

## Data and generation

- `sky-snapshot.ts` accepts Titlecase and lowercase keys through one adapter, preserves longitude/velocity/provenance, and rejects missing or invalid bodies. Missing planets never become Aries.
- `daily-sky.ts` anchors the edition at midnight UTC. Swiss Ephemeris is preferred; local Keplerian positions are explicitly approximate. Precise event claims require verified samples. Hourly samples and refinement identify ingresses, stations, lunar quarters and major aspect perfections. Sampling shares the cron deadline.
- `aspect-salience.ts` ranks verified perfections, lunar/personal rhythm, motion and orb instead of allowing a slow outer-planet aspect to dominate solely because its orb is smaller.
- `daily-episode.ts` plans a finite sequence, supplies each speaker with permitted evidence and actual prior claims, and checks structured factual assertions, coverage, recognizable contradictory astronomical claims, coordinates and repeated claims. Narrative checks distinguish statements of uncertainty from assertions that something happened.
- `daily-edition-review.ts` reviews the whole draft for semantic repetition, factual fidelity, meaningful hosting and beginner usefulness. A bounded repair can correct identified turns and Gregory's closing before a final review. A reviewed prefix without reported defects can survive a later rejected turn, with a factual remainder; an unavailable review fails safely to a complete factual briefing. This model review is an additional check, not a mathematical proof of entailment.
- `daily-edition-schema.ts` validates the saved/public boundary, including every body's source and observation time, coordinate consistency, lunar/aspect consistency with those coordinates, the UTC window, event evidence, evidence-backed coverage and Gregory's opening/closing.
- `daily-edition-store.ts` uses an atomic lease and token-checked publication. Three attempts per version/day are allowed; expired ownership cannot publish. A completely deterministic result releases the lease for a later bounded retry instead of freezing an outage as the day's hosted edition.

Publication identity includes the editorial, placement-knowledge and routing versions in `council-version.ts`. Bump the appropriate version when changing those inputs. Snapshot IDs also incorporate source, actual positions, events and previous-day comparisons.

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

The first implementation passed 2,016 default-suite tests across 173 files, with 22 tests/four files skipped, plus `bun run check` and the persona smoke test. These are the October 2 baseline results. See the [October 5 review record](daily-planetary-council-review-2026-10-05.md) for final validation and remaining limits. The admin heartbeat rendering assertion follows the configured job count, including the new council job.

Commands:

```sh
bun run check
bunx vitest run
bun run scripts/smoke-test-persona.ts
bun run scripts/eval-daily-council.ts --date=2026-10-05
```

The production-build anonymous HTTP endpoint returned a schema-valid October 5 briefing with eleven turns and labelled approximate positions. An unauthenticated private question returned HTTP 401 with a temporary local auth secret configured. The October 5 offline sample contains 878 words and covers all seventeen required topics for that snapshot. It is available as a reproducible result of the evaluation script, which writes Markdown and JSON to `/private/tmp` by default.

One opt-in live evaluation reached AI Gateway, but its configured credentials were rejected. It returned factual fallbacks; no model-written dialogue was available to assess. To evaluate actual voices after credentials are repaired:

```sh
bun run scripts/eval-daily-council.ts --date=2026-10-05 --live
```

This makes bounded model calls without database writes. Human review should assess factual fidelity, specificity, distinguishable voices, beginner learning, Gregory's curiosity/synthesis and whether successive claims add something. The sample sky remains explicitly approximate; the script does not certify astronomical accuracy. Browser automation timed out during local visual inspection; component rendering tests and the real HTTP route were verified, but a visual browser pass remains outstanding.

## Review follow-through

Standards review found deadline propagation, optional body provenance and version partitioning gaps; these were corrected. Spec review found a contradictory aspect-phase acceptance, truncated host history, absent day comparisons, missing prior hosted fallback and exact-string-only novelty checks; these were corrected. Subsequent review adds stricter snapshot/storage integrity, midnight boundary and shared-read regressions, bounded public reads, richer placement knowledge, targeted editorial repair, complete private-question context and elapsed event updates. Shared guards also reject contradictory lunar phases, ingress destinations and event-time attribution in daily dialogue and private replies. Live voice quality remains unverified until provider access works.
