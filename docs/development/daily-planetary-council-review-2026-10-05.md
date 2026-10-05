# Daily planetary council review · October 5, 2026

Review scope: `codex/daily-planetary-council` against main at `1a2b2cddeadffbd7039144eb69301fb44dbde4b4`, including the subsequent review fixes. The originating requirements are in the [quality audit and daily council design](planetary-group-chat-quality-audit-2026-10-01.md). The [implementation record](daily-planetary-council-implementation-2026-10-02.md) explains operation and schema provisioning.

## Standards

Independent review identified deadline propagation, incomplete per-body provenance and publication-version partitioning gaps. The final implementation gives each shared-sky reader its own wait deadline, bounds database and client reads, validates all ten positions at the storage boundary and partitions publication by editorial, knowledge and routing versions.

Additional integrity review corrected contradictory sign/degree/longitude and motion inputs, stored-row identity mismatches, events at the next UTC midnight, and lunar/aspect metadata inconsistent with opening coordinates. Shared daily/private factual guards now reject recognizable contradictions in phase, event destination and event timing. Regression tests cover each boundary. A generated backend Ruff cache is excluded from formatting checks; no application sources are excluded by that change.

No unresolved concrete standards defect was reported by the final independent pass. Deterministic checks and model editorial review provide bounded safeguards; they do not prove that arbitrary prose entails its cited evidence.

## Spec

Independent review identified accepted contradictory aspect phases, truncated host history, missing prior-day comparisons, absent previous-hosted-edition fallback and novelty checks limited to exact strings. These were corrected. Gregory receives accumulated claims, placement agents receive authored planet/sign knowledge and canonical persona material, and the edition has a finite coverage plan with explicit opening, integration and closing duties.

Further review corrected private replies that omitted the edition's lunar/event context or could attach a valid clock time to the wrong event. Private replies retain the exact opening brief and disclose the answer/observation window. Published editions remain immutable; separately labelled elapsed updates reveal already calculated verified events. Bounded editorial repair handles specific flagged turns before a second whole-edition review, and an unavailable reviewer yields a complete factual briefing.

The implementation supplies all ten placements, lunar rhythm, major aspects, motion, collective background and verified turning points when a verified ephemeris is available. Approximate positions and unavailable timing are disclosed. Actual model-written voice quality and a visual browser pass remain unverified; these are validation limits, not passed acceptance gates.

## Verification

- The final default suite passed 2,071 tests across 176 files, with 22 tests/four files skipped. The focused daily/private factual-guard suites also passed all thirty tests, including swapped event clocks and answer-time attribution regressions.
- `bun run check` passed lint, repository formatting and TypeScript.
- The persona smoke script and voice differentiation tests passed.
- `bun run build` completed compilation, lint/type validation, page generation and route output. Existing optional-integration and dynamic-dependency warnings remained.
- Prisma client generation passed. No database schema was applied and no deployment was performed.
- The local production GET returned HTTP 200 with a schema-valid October 5 edition: eleven turns, seventeen covered topics and explicitly approximate positions. The private-question POST rejected an anonymous caller with HTTP 401 after configuring a temporary local auth secret. A missing production auth secret initially produced HTTP 500, consistent with the repository's existing fail-closed auth configuration.
- Offline evaluation produced a schema-valid 878-word, eleven-turn briefing covering 17/17 required topics. It made no model calls or database writes.

Initial verification was interrupted by iCloud placeholders in source files, generated caches and dependencies. Locked dependencies were restored without changing lockfiles; unchanged tracked source files were materialized from matching local Git index copies while preserving pending edits. The clean subsequent suite run passed.

## Remaining acceptance checks

The available Vercel OIDC credential is expired and no direct provider credential is configured. An opt-in live evaluation reached the gateway but received authentication failures, so all turns fell back to factual text. A successful offline contract check does not establish captivating hosting, distinct live voices or semantic accuracy of generated prose.

To finish live quality assessment, configure a fresh `AI_GATEWAY_API_KEY` locally and run:

```sh
bun run scripts/eval-daily-council.ts --date=2026-10-05 --live
```

Review the resulting conversation against the rubric printed in its report: factual fidelity, specificity, voice distinction, beginner learning, meaningful responses, Gregory's curiosity/synthesis and repetition. Automatic approval review rejected fetching the linked Vercel project's full development environment because that would retrieve unrelated development secrets. No such environment file was fetched.

Browser automation timed out during local visual inspection. Component rendering tests passed, but responsive layout and interaction should receive a successful visual pass before release. Saved publication additionally requires normal Prisma schema provisioning and valid provider/ephemeris/cron configuration in the target environment.

The PR is kept in draft while live conversation quality and visual review remain outstanding. The implementation and automated review fixes are ready for code review; these remaining acceptance checks must not be represented as complete.
