# Planetary group chat: runtime and reliability research

Research date: October 1, 2026. Scope: the two group chat experiences actually mounted on the main page, their generation routes, model routing, context, state, caching, and relevant scheduled/persisted infrastructure. This is a source audit; no production model calls, credentials, database contents, or deployed behavior were inspected.

## Main conclusion

The main page contains two separate planetary conversations with different rosters, prompts, routes, state, and failure behavior. The larger Current Sky Chat has promising grounded orchestration but a broken sky payload contract and a director that rarely gives Greg a real host turn. The smaller Live Planetary Council bypasses that orchestration, receives an empty frontend full-sky prompt, and can display empty cached responses. Neither conversation is a shared, persisted daily edition. Improving prose alone would leave those underlying problems in place.

## Active architecture

| Surface                                       | Active trace                                                                                                                                                                                                                                              | Current behavior                                                                                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current Sky Chat / `CurrentPromotionalThread` | `app/page.tsx:819` → `components/landing/current-promotional-thread.tsx:1771` alias → `ExchangeStateMachine.startExchange` → `/api/agents/council-voice` → `dispatchTurn` → context, director, turn brief, canonical persona, structured voice generation | Ten planetary delegates and a Greg host node. Three static opening messages. One autonomous turn roughly every 22 idle seconds; two turns for a seeker; four for a degree transition. Messages are browser component state.                                     |
| Live Planetary Council                        | `app/page.tsx:903` → `components/landing/live-planetary-council-thread.tsx:378` → `/api/unified-multi-agent-chat` → `processAgentResponse` → `backend.agents.chat` → FastAPI `/api/chat`                                                                  | Seven eligible traditional bodies, four displayed delegates, only the first two requested to speak. Moon always enters first. A generic spontaneous opener on mount and manual question/refresh actions. Greg is absent. Messages are separate component state. |

Shared planetary input is `usePlanetaryPositions({ refreshInterval: 60000 })` (`app/page.tsx:315`). The hook requests positions and alchemical quantities through server actions (`hooks/usePlanetaryPositions.ts:113`, `lib/actions/backend-actions.ts:13`). The header data, roster, and generated responses have no common edition ID, immutable snapshot, or timestamp contract.

The larger card's useful infrastructure is active, not dead code: `app/page.tsx:819` renders it. Its canonical persona/context/director pipeline is **not** used by the smaller card. The full `/planetary-council` page is another experience: it renders `PlanetaryWisdomChat` with default Sun/Moon/Mercury and Monica support (`app/(app)/planetary-council/page.tsx:55`).

## Prioritized weaknesses

### 1. Blocker: Current Sky Chat cannot send a valid sky payload through its present contract

The UI builds `skyOverride` keyed by `cfg.planet`, producing titlecase names such as `Sun` and `Moon` (`current-promotional-thread.tsx:1023–1035`). The API schema requires all ten lowercase keys, such as `sun` and `moon` (`council-schema.ts:122–138`). The request therefore fails validation before `dispatchTurn` (`app/api/agents/council-voice/route.ts:29–59`).

Changing only the client to lowercase is insufficient. `buildServerCouncilContext` looks up `ephemeris[planetName]`, where `planetName` is titlecase, and silently substitutes missing bodies with Aries at zero degrees (`council-context.ts:149–157`). A lowercase map accepted by the schema therefore produces an invented all-Aries sky and 45 pairwise conjunctions. The parent research task reproduced both sides offline: titlecase rejected; lowercase accepted but all bodies substituted.

**Recommendation:** use one canonical typed sky snapshot throughout client, schema, and context. Normalize keys at a single boundary; preserve exact longitudes, velocities, source and observation time. Reject missing data or explicitly mark it unavailable rather than substituting a credible-looking chart.

### 2. Blocker for onlookers: model routes require identity, but both UIs behave as though public generation will work

Current Sky Chat always enables autonomous streaming initially (`current-promotional-thread.tsx:956`), yet its route requires a user or service with `failClosed: true` (`council-voice/route.ts:14`). Anonymous visitors receive 401 from `requireUserOrService` (`lib/security/privileged-api-auth.ts:119–137`). That happens before the council's grounded fallback. The exchange machine throws for non-2xx (`exchange-state-machine.ts:200–202`); the UI's `ERROR` branch only resets typing/reaction state (`current-promotional-thread.tsx:1106–1113`). The transcript remains its static opening lines, with no visible explanation. The 22-second cadence continues to try later (`:1244–1260`).

The smaller card auto-seeds without user interaction (`live-planetary-council-thread.tsx:513–530`), but its default standard mode requires auth and a token debit when its agents are outside the weekly free set (`unified-multi-agent-chat/route.ts:261–317`). It throws a generic error for any non-2xx and renders a celestial connection dropout (`live-planetary-council-thread.tsx:407–410`, `:491–504`). Authentication, insufficient balance, rate limiting and backend outages become indistinguishable. A signed-in visitor's automatic page seed can debit tokens, including a cached answer, because billing occurs before response-cache lookup (`unified-multi-agent-chat/route.ts:309`, `:595`).

**Recommendation:** public observation should read a server-produced daily edition, with service-authorized generation and an explicit budget. Personal consultation may remain authenticated and metered. Show actionable, accurate status for interactive errors; stop/back off on permanent auth and validation failures. A public read endpoint must not trigger a new model generation or a token debit on every view.

### 3. High: Greg's host identity exists, but normal conversation scheduling excludes him

The large card's opening Greg line is static state (`current-promotional-thread.tsx:902–913`). Autonomous candidates contain the ten planets and omit Greg (`conversation-director.ts:185–198`). Seeker exchanges default a secondary speaker to Greg, then overwrite it with the primary planet's first `tensionWith` partner (`:129–135`). Every canonical planet currently has a nonempty tension list (`planetary-personas.ts:36–145`), so ordinary two-turn seeker exchanges never reach Greg. Greg can appear in particular ingress combinations (`conversation-director.ts:311–321`, `:358–379`), but there is no guaranteed host welcome, question, transition, or closing synthesis.

The small card only constructs planetary agents (`live-planetary-council-thread.tsx:361–375`), so no Greg response can occur there at all.

**Recommendation:** give the host explicit editorial duties in the turn plan: opening thesis, an informed question for a relevant planet, translation of a disagreement, follow-up that identifies what the reader has not learned yet, and a closing synthesis/next watchpoint. Host turns should have access to the whole edition's verified evidence and coverage, rather than only the preceding proposition. Existing Greg persona resolution is available through `buildAgentContext('gregory')` (`lib/agents/persona/build-agent-context.ts:28–30`, `:51`).

### 4. High: neither active transcript guarantees the reader learns the day's landscape

The small card restricts eligibility to Sun through Saturn (`live-planetary-council-thread.tsx:46`), sorts aspect partners by smallest orb, puts Moon first, displays four, and sends only two (`:275–290`, `:361`). It excludes Uranus, Neptune and Pluto from both aspect selection and speech. It may omit one member of the very aspect it displays as strongest when Moon occupies one of the two speaking slots. Its only opening brief is an undifferentiated request to synthesize current transits (`:524–526`).

The large card directs isolated turns, not an edition. `buildTurnDirective` supplies a speaker's tightest aspect or placement, dignity, and at most one natal contact (`conversation-director.ts:446–508`); it does not attach moon phase, upcoming stations/ingresses, a date/time window, changes since yesterday, or a list of unaddressed significant facts. `compileTurnBrief` requests one new claim in one paragraph (`turn-brief.ts:50–55`). Recent history is only three messages (`current-promotional-thread.tsx:312–334`), so a long-running day cannot reliably track covered topics or avoid revisiting them. Autonomous speaker scoring excludes only the previous speaker and applies fixed aspect/archetype weights; it contains no recency decay despite its comment promising it (`conversation-director.ts:177–247`).

**Recommendation:** create a deterministic daily coverage plan before dialogue: solar season; lunar phase and sign/change window; strongest meaningful aspects with applying/separating state; retrogrades and stations; ingresses; slow collective background versus today's faster triggers; what changed; what comes next. Not every planet needs equal speaking time. Require each planned turn to answer a specific educational question and give a concrete implication. Maintain a coverage ledger and a distinctness ledger across the edition.

### 5. High: the smaller card's full-sky context is empty at the frontend prompt layer

`generateCosmicContext` calls alchemical quantities and returns `currentMoment`, a generic summary and timestamp; it never sets `planetaryPositions` (`unified-multi-agent-chat/route.ts:1395–1409`). The planetary prompt serializes `cosmicContext.planetaryPositions || {}` under CURRENT COSMIC ALIGNMENT (`:1153–1154`), so this block is `{}`. The request passes only the two agents' own placement configs; the computed phase, aspects and retrogrades from the UI never travel to this route (`live-planetary-council-thread.tsx:361–400`).

**Qualifier:** this does not prove every backend model sees an empty sky. FastAPI optionally augments the override prompt with Alchm MCP live-sky results (`backend/main.py:1278–1281`, `:384–402`). That depends on MCP enablement/health, is fetched independently of the UI snapshot, and its metadata is not displayed in this card. The frontend contract itself does not guarantee complete, coherent sky grounding.

The prompt also identifies the sign's element using `agent.consciousness.dominantElement` (`unified-multi-agent-chat/route.ts:1139`), but the factory prioritizes the planet's element over the sign's (`lib/unified-agent-factory.ts:101`, `:127`). This can label a sign with the wrong element. The prompt exposes numeric Monica/degree fields and lacks the qualitative-human-inference guard used by the council brief (`unified-multi-agent-chat/route.ts:1135–1156` versus `turn-brief.ts:50`).

**Recommendation:** consolidate on the server council pipeline after repairing its contracts; build prompts from a verified immutable sky snapshot plus a placement knowledge brief. Pass planet element and sign element as distinct concepts. Do not depend on incidental MCP augmentation for core grounding.

### 6. High: cache and mock replies can render as permanently empty bubbles

The unified route emits `agent_start`, calls `processAgentResponse`, then emits `agent_complete` with final content (`unified-multi-agent-chat/route.ts:341–372`). A cache hit returns the final response without emitting any `text` event (`:604–651`); MOCK_LLM does the same (`:657–680`). The small card handles `agent_start` and `text` only; it ignores `agent_complete`, `done`, and `error` (`live-planetary-council-thread.tsx:439–486`). Consequently a valid cached or mocked answer creates a bubble with empty content, rendered as an ellipsis (`:680–682`). Abrupt server errors can also finish without a visible explanation.

The current integration helper reads the `done` event, unlike this UI (`test/chat-system/stream-helper.ts:23–39`). Its cached-response test can pass while the real component is blank (`test/chat-system/integration/unified-api.test.ts:451–478`).

**Recommendation:** define one SSE protocol and a shared client reducer. Reconcile final `agent_complete` content even if there were no deltas, handle `error` and `done`, flush parsing on completion, and distinguish empty/partial/cached/fallback results. Add a component contract test with actual route events, not just the final `done` object.

### 7. High: the fallback is evidence-shaped prose, but often ignores the actual placement condition

Structured model output is schema-constrained and checked for allowed evidence IDs (`council-chamber.ts:124–157`). That is a useful existing seam. On failure, the route builds a deterministic briefing and still returns success with `grounded_briefing` provenance (`:159–176`).

The fallback's dignity dictionary is keyed by `domicile`, `exaltation`, `fall`, etc. (`grounded-briefing.ts:27–33`), but lookup removes `dignity-` from an evidence ID such as `dignity-moon`, then looks up `moon` (`:369–377`). It therefore selects generic posture rather than the supplied dignity label. `seat-*` evidence generated by the director (`conversation-director.ts:464`) has no corresponding fallback handler; the fallback only recognizes `sky-transit-*` placement evidence (`grounded-briefing.ts:382–387`). Aspect prose uses the generic aspect theme, ignoring named bodies, signs, phase and orb (`:359–365`). Natal contacts all receive one generic instruction (`:350–356`). Those limitations make very different skies sound alike, especially without model credentials.

Output filtering also mishandles ordinary language and numeric symbols: the regex flags the English word “fall” anywhere, while its ending word boundary misses a degree symbol or percent sign before a space (`council-schema.ts:69–78`). Parent offline examples: “Do not fall into the same habit.” is flagged; “Mercury is at 17° Virgo.” and “Illumination is 50% today.” are unflagged.

**Recommendation:** carry typed evidence fields rather than reconstructing meaning from ID strings. Render fallback facts and implications directly from actual sign, dignity, aspect partners, motion and phase. Treat fallback as a readable factual briefing; retain honest provenance. Make telemetry validation specific enough to permit natural language while catching intended patterns. Evidence-ID validity should be supplemented with fact/claim checks; correct IDs alone do not establish factual entailment (`council-chamber.ts:50–61`).

### 8. High: no shared daily persistence, publication boundary, or conversation cache isolation

Both cards append messages only to component state (`current-promotional-thread.tsx:897`, `:1102`; `live-planetary-council-thread.tsx:272`, `:446`). A reload starts a different local conversation. Autonomous cadence lives in a browser tab; closing the page ends it. The smaller card seeds once per mount and does not reseed on later position changes while messages exist (`live-planetary-council-thread.tsx:513–530`). Its refresh clears state before fresh sky data is necessarily ready (`:534–539`), and it has no abort controller or request ID to prevent an old stream from appending into the refreshed conversation (`:378–487`). Its live metadata can update while old replies remain.

The unified route creates a new UUID per POST (`unified-multi-agent-chat/route.ts:192–193`), and forwards `userId: 'session-user'`, without `context` or the full structured history (`:696–703`). FastAPI nevertheless persists every `/api/chat` response regardless of the frontend's `enableMemoryPersistence: false` (`backend/main.py:1315–1326`) and emits feed events (`:1331–1360`). These records are per-agent calls, not a canonical readable day edition, and the synthetic user ID does not represent the signed-in caller.

Unified cache context excludes sky, history, persona version, actual user/session, and group roster. `buildCacheContext` decides “group” only if `requestData.agents` exists (`agent-cache-system.ts:771–786`), whereas this route passes `groupAgents` (`unified-multi-agent-chat/route.ts:595–600`). Exact context hashing includes only agent, conversationType, time-of-day and message length (`agent-cache-system.ts:439–446`). Semantic matching ignores even that context (`:206–249`, `:708–737`). Repeated/similar questions to the same agent can reuse another conversation's reply, including references to its participants, and with the present SSE issue that reuse is invisible.

**Recommendation:** persist one immutable edition with date/timezone, snapshot ID, editorial plan, ordered turns, fact references, coverage, model/prompt version, provenance and status. Generate with an idempotent edition key and a lease, then atomically publish a completed edition. Public readers load the same transcript; personal questions branch into a separate conversation. Cache published edition artifacts by snapshot/prompt version. Disable generic semantic response caching for conversational turns or key strictly by all causal context.

## Model routing: active versus misleading infrastructure

- The small card's regular agents use `backend.agents.chat`, with standard mode mapped to `free`, oracle to `primary`, and epiphany to `reflective` (`unified-multi-agent-chat/route.ts:686–703`). The endpoint helper points to FastAPI `/api/chat` (`lib/backend.ts:642–676`). FastAPI honors `systemPromptOverride` verbatim before RAG/MCP augmentation (`backend/main.py:1241–1281`). Its provider fallback chain can eventually use paid OpenAI even for `free` (`backend/providers.py:119–164`). Credential/model availability was not inspected.
- `selectOptimalModel` and `resolveModelOverride` in the unified route have no call sites in that file; changing those helpers would not change the regular landing planetary model (`unified-multi-agent-chat/route.ts:1279`, `:1327`). `modelOverrides` is copied into group context but is not consumed by the `backend.agents.chat` call. `getAgentTemperature` is recorded as telemetry, not passed in that backend request (`:696–703`, `:748`).
- Current Sky Chat uses `generateStructuredVoice`, choosing substantive tier for a host or seeker turn and ambient tier otherwise (`council-chamber.ts:119–131`). Selection depends on gateway/credential availability, with grounded fallback if unavailable (`lib/agents/persona/voiced-generation.ts:85–114`). This path does not call FastAPI or its historical-agent RAG. It uses `buildAgentContext` and the canonical persona block (`council-chamber.ts:111–117`).
- Persisted transit group sessions and an atomic one-time seed claim already exist, but serve internal transit links and `/gallery/group/[id]`, not either landing transcript (`lib/agents/transit-group-session.ts:6–11`, `:129–149`; `app/api/group-chat/seed/route.ts:2`). They are a precedent for idempotency, not proof that the landing daily edition is persisted.
- `vercel.json:15–44` schedules feed/agent/league/reservoir/weekly jobs, but no landing council edition. The feed pusher does evaluate degree changes (`lib/agents/feed-pusher.ts:169`), so this scheduled planetary activity exists; neither landing component hydrates that feed as its transcript. A feed post or a backend conversation row is not the same artifact as the day's group chat.

## Verification and limits

No runtime code changed. No paid model calls, live databases, secrets, deployment checks or UI sessions were used.

Parent task ran four mocked suites: 69 tests passed (47 council dialogue quality, 6 CurrentPromotionalThread component, 14 persona voice differentiation, 2 planetary model routing). The suite result supports existing geometry/persona helpers and mocked route behavior, but does not cover the actual UI→request-schema→context key contract, anonymous observation, cached SSE rendering, or a complete daily edition.

This runtime audit independently ran one offline `bun -e` diagnostic importing context/director/brief/fallback functions. Exact outputs:

- Ten preferred-delegate seeker exchanges selected: Sun→Neptune, Moon→Saturn, Mercury→Neptune, Venus→Mars, Mars→Venus, Jupiter→Saturn, Saturn→Jupiter, Uranus→Saturn, Neptune→Mercury, Pluto→Venus. Greg selected: **false**.
- Autonomous turn after Greg selected: **Sun**.
- Changing only Moon's dignity evidence label to “Moon in Taurus exaltation posture” changed fallback text: **false**.

The parent also reproduced the sky key and telemetry regex failures described above. These checks are offline deterministic diagnostics, not subjective proof of final model voice quality. Provider behavior, deployed key configuration, ephemeris accuracy and real generated prose still require separate verification after the contracts are repaired. The backend's source planetary position function currently uses constant orbital periods and reports no retrograde (`backend/main.py:584–606`); the sky-data audit owns the detailed astronomical-source findings.

## Recommended implementation order

1. **Repair data and transport contracts:** canonical sky keys, completeness validation, exact longitude/motion/time/provenance, SSE final/error reconciliation, understandable auth and credit states, cancel/stale-request guards. Add the missing boundary tests.
2. **Choose one council runtime:** use the structured context/director/persona seam for the main-page experience; keep the second surface as a compact view of the same edition or remove duplication as a product decision. Avoid parallel conversations with conflicting facts.
3. **Build the daily artifact and editorial plan:** service-generated shared edition, explicit timezone/date, idempotent persistence/public read path, ranked events and a coverage ledger. Generate one coherent snapshot-based edition rather than one new council per browser.
4. **Make Greg an explicit host:** guaranteed opening/bridge/synthesis turns, authentic persona plus relevant corpus when available, concrete questions, controlled disagreement, explanations of why this particular day's sky matters.
5. **Ground each placement's contribution:** curated domain knowledge, typed evidence, sign/planet/degree condition distinctions, practical examples, phase and temporal context. Repair informative deterministic fallbacks before relying on model polish.
6. **Evaluate complete editions:** fact correctness and evidence entailment, coverage, educational clarity, distinct voices, specificity to the snapshot, repeated phrases, host continuity and degraded-mode honesty. Use several frozen skies, including no strong aspects, stations, sign transitions and model failure; judge the full transcript rather than isolated eloquent paragraphs.
