# Admin agent operations

The admin panel follows the progression vocabulary in `CONTEXT.md` and the source limitations in `vessel-progression-integration.md`.

## Scope

- `/admin` summarizes catalog Vessel Level, recorded lifetime EXP and current rating coverage, with links to progression, roster and recipe operations.
- `/admin/leveling` uses the canonical progression service with one clock and one sky observation for the roster. It shows Vessel Level, lifetime EXP, next-level EXP, Base Overall, level boost, Baseline Overall, Current Overall, signed transit change, source status and observation time. Search, status filtering, sorting and a per-agent inspector expose the existing 19-stat and experience breakdown. `?agent=<id>` opens that agent's inspector.
- Legacy database level, XP and EV fields never substitute for Vessel progression. The separate EV section reports all agents with recorded EVs, with a limited preview; a positive EV balance does not establish that training is currently active.
- `/admin/agents` adds shared catalog faction, era, archetype and likeness coverage, plus search and links to profiles and progression. Declared model assets and portrait paths describe catalog coverage, not a successful remote asset probe.
- `/admin/recipes` retains generation latency and adds catalog coverage and the recent agent recipe pipeline: source, recipe, substitutions, action status and persisted feed acknowledgement. Comment delivery is not independently recorded.
- Reports remain read-only and admin-gated. Independent source failures retain their reason, surface an alert and leave other sections readable. New diagnostics join the overview's unified alert digest.

## Source boundaries

Vessel EXP reflects the existing deterministic catalog training import where recorded. Durable runtime receipts and cross-site awards remain pending; this change does not initialize accounts, backfill history or grant EXP. Current ratings require the complete recorded stats and attributed natal inputs accepted by the progression engine. Missing inputs keep ratings unavailable without erasing known growth. The existing sky adapter supplies an explicitly approximate observation, so an estimate is not displayed as a verified live rating.

User-created agents remain counted in database telemetry. The progression and likeness tables cover the bundled historical catalog; this change does not expose private forged-agent charts or claim progression coverage for them.

## Acceptance

- Include agents at level 100 and agents whose experience or ratings are unavailable; preserve genuine zero EXP.
- Keep known EXP and baseline visible during sky outages and catalog progression visible during a legacy database outage.
- Validate nested response data before rendering. Preserve the last good report with an error notice after a failed refresh.
- Show rising, falling and unavailable states in words, with signs and accessible reasons. Confine wide tables to their cards on mobile.
- Display actual imported-conversation evidence from the canonical ledger contract.
- Keep recipe catalog data independent of recent database activity and distinguish feed acknowledgement from comment delivery.
- Reject unauthorized report requests before reading the catalog, sky or database.
