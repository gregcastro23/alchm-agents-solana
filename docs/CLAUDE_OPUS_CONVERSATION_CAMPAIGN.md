# Conversation Improvement Campaign — Current Sky Chat

> **Status:** ✅ **CAMPAIGN FULLY EXECUTED & VERIFIED** (2026-09-09)  
> **Test Suite:** 56/56 passing tests (`test/components/council-dialogue-quality.spec.ts` + `CurrentPromotionalThread.spec.tsx`)  
> **TypeScript & Lint:** 0 errors on `bun x tsc --noEmit` & `bun run lint`  
> **Delivered by:** Claude Opus + Pair Assistant

**Target component:** `components/landing/current-promotional-thread.tsx` (1790 lines)  
**Goal:** Replace flat, single-voice council dialogue with authentic multi-agent discourse driven by real aspect geometry.  
**Audit date:** 2026-09-09 · verified against `main` @ `0994f9d`

---

## 1. Diagnostic findings (all verified in source)

### F1 — The persona lock, and why it exists

`app/api/agents/council-voice/route.ts:7-9`

```ts
const AGENT_MAP: Record<string, string> = { gregory: 'greg-castro-1991' }
const key = (agentKey || 'gregory').toLowerCase()
const agentId = AGENT_MAP[key] || 'greg-castro-1991'
```

Every planetary key (`sun`…`pluto`) falls through to `greg-castro-1991`.
`generateVoicedText(agentId, …)` (`lib/agents/persona/voiced-generation.ts:36`) passes
`ctx.personaBlock` as the **system** prompt — so all ten delegates share Gregory Castro's
system persona.

**This is not a typo — it is load-bearing.** `buildAgentContext('sun')` returns `null`
(`lib/agents/persona/build-agent-context.ts:41-42`), because no planetary `CraftedAgent`
exists: `STAR_AGENTS` holds only `sirius`, `arcturus`, `vega`, `polaris`, and
`lib/demo-agents.ts` holds only `monica-001`. A `null` context makes `generateVoicedText`
return the static fallback immediately. Mapping `sun → 'sun'` would therefore make the
component _worse_ — it would silence the LLM entirely and expose the canned 1-liners.

The route does carry per-planet archetype strings (`AGENT_BASE_ARCHETYPES`, lines 11-32),
but they sit in the **user** prompt, where Gregory's system block dominates the voice.

**Two viable fixes:**

- **(a)** Add an optional `systemOverride?: string` to `VoicedGenerationOptions` so the
  route can supply a planet-specific persona block without inventing DB agents.
- **(b)** Build ten planetary `CraftedAgent` records seeded from `PLANETARY_TRAITS`
  (`lib/agents/planetary-traits.ts:58`) + `lib/agents/planetary-agent-stats.ts`, and
  register them in the `findAgent` lookup chain.

(a) is the smaller, reversible change and is recommended first.

### F2 — No conversation history reaches the model

`fetchCouncilVoice`'s payload (`current-promotional-thread.tsx:290-310`) carries agent
identity, degree, dignity, and ingress metadata — **but no prior messages**. Each delegate
speaks into a vacuum, which is why turns never build on one another.

The predecessor did this correctly. In `barbault-basket-promotional-thread.tsx`
(commit `552b270`, removed at `7d5f0e4`):

```ts
const lastSpeaker = lastMsg ? lastMsg.senderName : 'Council'
// …
return `Building on ${lastSpeaker}'s point: true strength isn't loud or aggressive…`
return `Responding to ${lastSpeaker}: authentic evolution requires shadow work…`
```

**This is the single largest quality gap.** It explains the "Barbault felt richer" intuition
better than any other finding.

### F3 — Aspect geometry exists, but never reaches the dialogue

Aspects _are_ computed — inline, inside the SVG rendering `useMemo`
(`current-promotional-thread.tsx:477-520`): conjunction (orb ≤ 6°), opposition (±6°),
trine (±5°), and more. They render as coloured chords on the wheel and are then discarded.

Meanwhile the dialogue sequencer (`current-promotional-thread.tsx:1103-1110`) orders
speakers by **raw angular proximity only**:

```ts
const sortedOthers = [...otherPlanetKeys].sort((a, b) => distA - distB)
```

So a planet 4° away speaks before one holding an exact opposition. The council is spatially
aware and geometrically blind.

### F4 — Fallbacks are static one-liners

`generateSpontaneousCouncilResponse` (lines 330-390) is a hardcoded `switch` — e.g.
`"Energy is high at 22° Taurus. Direct your fire where it builds rather than burns."`
`generateIngressReactionFallback` (393-418) is slightly richer (it does cite the moving
planet and element) but still never names another speaker.

These render for unauthenticated visitors and whenever `GROQ_API_KEY` is absent — i.e. the
landing page's first impression is frequently the canned path.

---

## 2. Prompt for Claude Opus

```markdown
You are the Lead Computational Astrologist and Conversation Architect for Planetary Agents.

Execute the Conversation Improvement Campaign for the landing component
"Current Sky Chat: Real-Time Planetary Degree Council".

Read docs/CLAUDE_OPUS_CONVERSATION_CAMPAIGN.md first — it contains a verified diagnostic
audit with exact file:line references. Trust its findings; re-verify before contradicting.

Mission: make the ten planetary delegates debate, challenge, and build on each other,
driven by their real aspect geometry to the changing degree.

Work in this order:

1. Unlock the persona (F1). Add `systemOverride?: string` to `VoicedGenerationOptions` in
   lib/agents/persona/voiced-generation.ts. When present, use it as the system prompt and
   skip the buildAgentContext null-guard. Then build ten planetary persona blocks in
   lib/agents/council/planetary-personas.ts, seeded from PLANETARY_TRAITS. Do NOT map
   planet keys to nonexistent agent ids — buildAgentContext returns null for them and the
   LLM call is skipped entirely.

2. Extract the aspect engine (F3). Create lib/agents/council/aspect-dialogue-engine.ts.
   Move the aspect math out of the SVG useMemo in current-promotional-thread.tsx:477 and
   have the wheel consume the shared module, so geometry has exactly one definition.
   Support: conjunction 0±8, opposition 180±8, trine 120±7, square 90±7, sextile 60±5,
   quincunx 150±3, semi-sextile 30±2. Return applying/separating and exact orb.

3. Thread the conversation (F2). Add a `recentTurns: {speaker, text}[]` field (last 3) to
   the fetchCouncilVoice payload and to the council-voice route's prompt. Instruct the
   model to name and respond to a prior speaker.

4. Re-sequence ingress (F3). In triggerDegreeChangeEvent (~line 1103), order speakers as:
   nearest neighbour → tightest aspect partner → remaining delegates → moving planet's
   final word. Surface aspect badges ("SQUARE 89.4°", "OPPOSITION 179.2°") alongside the
   existing NEAREST NEIGHBOR badge at line 1657.

5. Rewrite the fallbacks (F4). Make them procedural and aspect-aware, citing the previous
   speaker by name. The offline path should read as conversation, not as ten monologues.

6. Test. Add test/components/council-dialogue-quality.spec.ts covering aspect math across
   sign boundaries (the 359°/1° wrap), fallback inter-agent citation, and speaker ordering.

Verify with:
bunx vitest run test/components/
bun run lint
bunx tsc --noEmit
```

---

## 3. Files in scope

| File                                                | Change                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `lib/agents/persona/voiced-generation.ts`           | add `systemOverride`                                                     |
| `lib/agents/council/planetary-personas.ts`          | **new** — ten persona blocks from `PLANETARY_TRAITS`                     |
| `lib/agents/council/aspect-dialogue-engine.ts`      | **new** — aspects, orbs, applying/separating, procedural fallbacks       |
| `app/api/agents/council-voice/route.ts`             | drop the Gregory fallback; accept `recentTurns` + aspect context         |
| `components/landing/current-promotional-thread.tsx` | consume shared aspect module; thread history; re-sequence; aspect badges |
| `test/components/council-dialogue-quality.spec.ts`  | **new**                                                                  |

## 4. Manual verification

1. `bun dev`, open `http://localhost:3000/#current-promotion`
2. Click **⚡ Advance Moon 1° (Simulate Shift)**
3. Expect: ingress alert → nearest neighbour → aspect partner (badged with its aspect and
   orb) → remaining delegates, each naming a prior speaker → moving planet's final word
4. Unset `GROQ_API_KEY` and repeat — the fallback path must still read as a conversation.
