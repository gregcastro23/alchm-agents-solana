# MCP Phase 5: Durable Council Deliberations, Multi-Turn Critique/Synthesis, and Recovery Engine

**Status:** Planned / Architecture Blueprint  
**Target Repositories:** `AlchmAgentsSolana` (ASOL) & `WhatToEatNext-master` (WTEN)  
**Preceding Milestones:** Phase 3 (Typed Contracts & Official Transport), Phase 4 (Shared Context, Bridge Concurrency, Child Isolation)

---

## 1. Executive Summary

While Phase 4 resolved subprocess concurrency, eliminated 18 redundant Alchm queries via `EvidenceSnapshot` reuse, and hardened the subprocess environment against secret leaks, **the council execution lifecycle remains an in-memory `asyncio.gather` task**. If the host process restarts, times out, or cycles during a complex multi-persona debate, the entire deliberation state is lost.

**Phase 5 transforms Planetary Agent councils into durable, fault-tolerant alchemical deliberation workflows.** It introduces:

1. **Persistent Deliberation Runs (`council_runs`)**: Durable state machine enabling recovery across restarts.
2. **Structured Dialectic Deliberation (Thesis $\to$ Antithesis $\to$ Synthesis)**: Authentic philosophical debate where personas challenge and refine each other's culinary hypotheses.
3. **Strict Quota & Circuit-Breaker Guardrails**: Token and wall-clock execution budgets with graceful degraded termination.
4. **Cross-Repo Dual-Write Attestation**: Automatic publication of council consensuses into WTEN's `feed_events` and recipe community tips.

---

## 2. Core Architecture Components

```
                    ┌──────────────────────────────────────────────┐
                    │               MCP Caller / UI                │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   Durable Council Orchestrator (Phase 5)                        │
│                                                                                  │
│   1. Initialize Run          2. Multi-Turn Dialectic       3. Synthesize & Seal  │
│   ┌────────────────────┐     ┌───────────────────────┐     ┌──────────────────┐  │
│   │ council_runs table │ ──> │ Turn 1: Stances       │ ──> │ Elemental Harm.  │  │
│   │ - run_id           │     │ Turn 2: Cross-Critique│     │ Consensus Recipe │  │
│   │ - snapshot_id      │     │ Turn 3: Jing Clash    │     │ Publication Seal │  │
│   └────────────────────┘     └───────────────────────┘     └──────────────────┘  │
│             │                            │                           │           │
│             ▼                            ▼                           ▼           │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │        Postgres Run State Machine (PENDING → DEBATING → SEALED)         │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────┬───────────────────────────────────────┘
                                           │
               ┌───────────────────────────┴───────────────────────────┐
               ▼                                                       ▼
┌───────────────────────────────┐                       ┌──────────────────────────────┐
│  Alchm MCP Bridge (Pipelined) │                       │  WTEN Publication Service    │
│  - EvidenceSnapshot           │                       │  - user_recipe_interactions  │
│  - Semaphore(4) Concurrency   │                       │  - feed_events narration     │
└───────────────────────────────┘                       └──────────────────────────────┘
```

---

## 3. Detailed Workstreams

### Workstream 1: Persistent Council Workflow Model (`backend/models.py`)

Create a durable workflow model in PostgreSQL / SQLite:

```python
class CouncilRun(Base):
    __tablename__ = "council_runs"

    id = Column(String(64), primary_key=True)               # run_xxxx
    topic = Column(String(512), nullable=False)
    agents = Column(JSONB, nullable=False)                  # ["Socrates", "Rumi", "Galileo"]
    status = Column(String(32), default="pending")          # pending, debating, synthesizing, completed, failed
    current_phase = Column(String(32), default="thesis")    # thesis, critique, synthesis
    evidence_snapshot_id = Column(String(64), nullable=True)
    dialogue = Column(JSONB, default=list)                  # Array of turns and critique citations
    consensus_summary = Column(Text, nullable=True)
    tokens_spent = Column(Integer, default=0)
    budget_tokens = Column(Integer, default=8000)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
```

- **Restart Recovery**: When the backend boots or a worker thread recovers, query `SELECT * FROM council_runs WHERE status IN ('pending', 'debating')`. If a run was interrupted mid-turn, resume from the last completed turn without re-running finished stances.

---

### Workstream 2: Three-Phase Dialectic Deliberation Engine

Move beyond independent, isolated prompt queries into an authentic conversational debate:

1. **Phase A — Thesis (Opening Positions)**:
   - Each agent evaluates the `EvidenceSnapshot` through their distinct philosophical and planetary lens.
   - Outputs: 1 clear claim regarding elemental balance, humors, or spiritual transformation.
2. **Phase B — Antithesis (Targeted Cross-Examination & Critique)**:
   - Agents are paired using astrological synastry aspects (e.g. Socrates $\square$ Galileo, Rumi $\triangle$ Hypatia).
   - Each agent receives the prior turns of their synastry counterpart and must explicitly challenge or critique their assumption (addressing virtue vs. empiricism, heat vs. moisture).
   - If a Jing clash is active (e.g., _Freeze_ counters _Meltdown_), the debate prompt compels direct elemental combat in voice.
3. **Phase C — Synthesis (Consensus & Alchemical Sealing)**:
   - The Council Host (Hermes Trismegistus or Gregory Castro) reviews the dialogue transcript.
   - Produces a unified alchemical decree: which spices balance the excess Fire, which cooking method transmutes the Water, and an overarching score.

---

### Workstream 3: Hard Budgets, Token Quotas & Termination Guarantees

- **Per-Turn Budget Enforcement**:
  - `ExecutionContext` tracks `remaining_budget` and total token consumption across LLM provider turns.
  - If a debate exceeds 75% of allocated token budget or 30s remaining wall-clock, Phase B automatically concludes and forces early transition to Phase C (Synthesis).
- **Graceful Degradation Guarantee**:
  - A council debate must **never crash or leave an open transaction**. If an agent provider fails (e.g. Groq 429), fall back down the provider ladder (Groq $\to$ Gemini $\to$ OpenAI) or record an in-character alchemical silence (`"[Carl Jung remained silent, contemplating the archetypal void]"`) without killing the council run.

---

### Workstream 4: Dual-Write Settlement into WTEN

When a Council Run transitions to `completed`:

1. **Catalog Recipe Association**:
   - If the council debate focused on a specific recipe (e.g. `lentil-soup`), call WTEN's internal reflection route (`POST /api/internal/agent-recipes/reflections` or `POST /api/recipes/[recipeId]/community-tips`).
   - Persist the consensus critique directly into `user_recipe_interactions` so visitors to `alchm.kitchen/recipes/lentil-soup` see the Council's official philosophical review.
2. **Live Feed Event Narration**:
   - Emit an `agent_council_deliberation` event into `feed_events` via `feedDatabaseService.ts`.
   - Connected browser clients receive the real-time event on `/feed` with interactive expanders revealing the 3-phase dialogue transcript.

---

## 4. Verification & Testing Strategy

1. **Recovery Invariant Test (`test_council_recovery.py`)**:
   - Spawn a multi-turn council run.
   - Forcefully terminate execution after Phase A.
   - Re-instantiate the orchestrator and assert that Phase B resumes from the exact recorded dialogue without repeating Phase A turns.
2. **Budget Expiration Test (`test_council_budgets.py`)**:
   - Configure a mock provider that consumes 90% of the token quota in Turn 1.
   - Assert that the engine cleanly triggers early synthesis, logs a `BUDGET_CONTAINED` flag, and returns 200 OK.
3. **Synastry Cross-Critique Contract Test (`test_council_synastry.py`)**:
   - Provide natal charts with an exact Mars-Saturn opposition.
   - Assert that Phase B dialogue contains cross-agent citations referencing the opposition.
4. **Static Quality Gates**:
   - `PYTHONPATH=backend uv run pytest backend/tests/test_council*.py`
   - `bunx tsc --noEmit` (ASOL)
   - `bun run check:diff-assertions` (WTEN)

---

## 5. Execution Sequence

| Step    | Milestone        | Key Deliverables                                                                          |
| :------ | :--------------- | :---------------------------------------------------------------------------------------- |
| **5.1** | Schema & Storage | Migration adding `council_runs` table in ASOL; CRUD service for workflow lifecycle.       |
| **5.2** | Dialectic Engine | 3-Phase orchestrator (`thesis` $\to$ `critique` $\to$ `synthesis`) with synastry pairing. |
| **5.3** | Crash Recovery   | Worker bootstrap recovery loop sweeping unsealed runs on startup.                         |
| **5.4** | WTEN Federation  | Webhook/API bridge dual-writing council consensus into recipe community tips and feed.    |
| **5.5** | Test & Hardening | Full unit suite, timeout/budget torture tests, and packaging verification.                |
