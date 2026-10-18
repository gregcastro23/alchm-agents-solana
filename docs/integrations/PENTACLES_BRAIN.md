# ASOL ↔ Pentacles contract (the brain and the sign-in issuer)

What the **Pentacles** game (`gregcastro23/Pentacles`) calls on ASOL, and what each call must return.
Written **from the code on both sides**. Pentacles source read at `gregcastro23/Pentacles@57c71771`
(2026-10-15); ASOL paths are relative to this repo. Production measurements are dated where they appear.

## 0. Who answers

| Origin                                | What it is                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `https://api.agents.alchm.kitchen`    | Railway project `passionate-vibrancy`, service `planetary agents`, **this repo's `main`**, root `backend`. The **primary brain**. |
| `https://alchm-agents-eth.vercel.app` | Vercel, this repo's `main`. The **fallback brain** (`app/api/agents/{jing,word-duel,pillar,oracle}/route.ts`).                    |

Merging a change to `backend/` therefore deploys the live Python API, and every merge to `main` deploys the Vercel app.

## 1. Transport rules (Pentacles `feeder/brain.ts`)

- `POST <base><path>`, `Content-Type: application/json`, **no auth header**.
- One attempt at the primary, then one at the fallback, then the feeder's own local logic.
- 15 s per attempt, 30 s for the Oracle.
- **All of these count as a failure and send the feeder on to the fallback:** a network error, a non-2xx status, a body that is not
  JSON, or a body its validator rejects (returns `null`).

Consequence for this repo: **when a brain cannot answer, it must answer non-2xx.** A `200` with placeholder text is not a
failure to the feeder — it is written to SpacetimeDB and shown to the player. (`/api/chat` returns `200 "[All providers unavailable]"`
by design; the Oracle route must not copy that.)

The same primary also serves two reads: `GET /planetary/current` (live sky for the Oracle's context, 4 s timeout) and `GET /health`
(supervisor probe).

## 2. Routes

| Route                        | Served by                                                                               | Request                                                                                                        | Success                                                                               | Failure                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/agents/oracle`    | `backend/main.py` + `backend/oracle_brain.py`; Vercel `app/api/agents/oracle/route.ts`  | `{question, context}`; question trimmed, non-empty, ≤ 500 **bytes**; context a string, capped at 2000 chars    | `200 {answer, provider, model, timestamp}`                                            | `400` bad input (a body that is not a JSON object is FastAPI's `422`); `503` no provider answered in time; `429` rate limited |
| `POST /api/agents/jing`      | `backend/main.py` + `backend/duel_brain.py`; Vercel `app/api/agents/jing/route.ts`      | `{planet, opening, source}`; PascalCase planet, opening one of `Meltdown\|Freeze\|TectonicRoot\|Vacuum\|Erode` | `200 {success: true, planet, move, voice, element, source, timestamp}`                | `400` bad planet/opening; `429`                                                                                               |
| `POST /api/agents/word-duel` | `backend/main.py` + `backend/duel_brain.py`; Vercel `app/api/agents/word-duel/route.ts` | `{planet, rack, candidates: string[], context: {playerWord, playerScore}, source}`                             | `200 {success: true, planet, move: {word, rationale, score, source, ...}, timestamp}` | `400` bad planet/rack; `422` candidates missing, **empty**, or none spellable from the rack; `429`                            |
| `POST /api/agents/pillar`    | **Vercel only** (`app/api/agents/pillar/route.ts`, deterministic, no LLM)               | `{planet, opening, sky, source}`                                                                               | `200 {success: true, pillar, voice}`                                                  | not served by the FastAPI primary: it answers `405`, and the feeder falls through to Vercel                                   |

The feeders' validators, verbatim (these are the contract — `backend/tests/test_pentacles_brain.py` ports each one):

```ts
// oracle
j => {
  const a = j && typeof j.answer === 'string' ? j.answer.trim() : ''
  return a || null
}
// jing
json?.success === true && typeof json.move === 'string' && Object.hasOwn(COUNTER_OF, json.move)
  ? { move: json.move, voice: String(json.voice ?? '') }
  : null
// word-duel
json?.success === true && json.move && typeof json.move.word === 'string' && json.move.word
  ? {
      word: json.move.word,
      rationale: String(json.move.rationale ?? ''),
      score: Number(json.move.score ?? 0),
    }
  : null
```

### Word duel: the reducer trusts what it is given

The Pentacles reducer does **not** check the word and trusts the returned score. So the brain

- plays only a word from `candidates` (a model's pick is re-validated against them; anything else falls back to a deterministic pick),
- always **recomputes** the score: `round(Σ letter values × length multiplier)`, with ×1.0 for ≤ 3 letters, ×1.5 for 4, ×2.0 for 5,
  ×2.5 for 6, ×3.0 for ≥ 7 (`CAT` 5, `STAR` 6, `SPELL` 14, `LIGHT` 18). `Math.round` rounds half **up**; Python's `round` does not,
  so `duel_brain.word_score` uses `floor(x + 0.5)`.

An empty `candidates` is `422 no_legal_candidates`, not `200` with `word: ""` (which the feeder rejects as contract-violating).

### Jing: the counter graph

Meltdown→Vacuum, Freeze→Meltdown, TectonicRoot→Erode, Vacuum→Freeze, Erode→Vacuum. It is the same graph in
`lib/agents/duel/jing-rules.ts` (`WINNING_COUNTER`), `backend/duel_brain.py`, `backend/planetary_agents_mcp_server.py`
(`JING_WINNING_COUNTER`) and the Pentacles server's `JingMove::countered_by`. Tests pin the Python copies against each other and the
TypeScript one against the source file.

### Oracle: persona and length

The system prompt is the Pentacles `SYSTEM_PROMPT` from `feeder/oracle-service.ts`, ported **byte-exact** to
`backend/oracle_persona.py` and `lib/agents/oracle-persona.ts` (SHA-256 `f256dc75…b66b1`, asserted by both test suites). It is the
prompt-caching prefix, so it has no interpolation and must not change casually. The seeker's question and the live-sky context go in
the **user** turn:

```
Context:
{context}                      # omitted when the feeder sent none

Question:
{question}

Reply in at most 120 words.
```

`max_tokens` is 280. The player's client gives up after 25–30 s; the brain bounds each provider call (default 6 s) and the whole walk
(default 12 s) and answers `503` rather than keep the player waiting. The feeder asks the primary and then the Vercel app in turn, so two full
budgets fit inside the player's 25 s. A provider that answers with an empty completion counts as a failed link and the walk moves on.

## 3. The OIDC issuer (Google sign-in)

Pentacles' browser client exchanges the shared `.alchm.kitchen` session cookie for a token:

```js
fetch(`${ISSUER}/oidc/token`, {
  method: 'POST',
  credentials: 'include',
  headers: { accept: 'application/json' },
})
// reads { token, user }; 401 => not signed in; any other non-2xx => stay anonymous
```

SpacetimeDB then validates that token by fetching `{issuer}/.well-known/openid-configuration` and the JWKS, so **the issuer must be
exactly `https://api.agents.alchm.kitchen`** (audience `pentacles`, RS256, 30-day tokens). Code: `backend/oidc.py`.

| Route                                   | Behaviour                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /.well-known/openid-configuration` | static discovery document; needs no key                                                                                                    |
| `GET /.well-known/jwks.json`            | public half of `OIDC_SIGNING_KEY_PEM`; `503` without the key                                                                               |
| `POST /oidc/token`                      | forwards the caller's `Cookie` to `KITCHEN_SESSION_URL`; `200 {token, claims, user}`, `401` anonymous, `503` kitchen unreachable or no key |
| `GET /oidc/session`                     | same session check, never mints a token                                                                                                    |

A kitchen outage is **503, never 401**, so clients do not mistake an upstream failure for "logged out". The key's `kid` is the RFC 7638
thumbprint, so the same key gives the same `kid` across restarts; reusing the original key keeps outstanding Pentacles tokens valid, a
new key keeps every identity (the `sub` is the kitchen user's stable id) but signs everyone out once.

## 4. Providers and tiering (what actually answers)

The Oracle, word-duel and jing-voice calls use the same chain as `/api/chat` (`backend/providers.py:build_chain`): with
`HISTORICAL_AGENT_DEFAULT_TIER=free` (the default) it is Groq → Cerebras → Qwen (OpenRouter) → Gemini → OpenRouter → OpenAI
last-ditch; a paid tier puts Anthropic first. Links without an API key are skipped.

**Measured 2026-10-15 on the production service** (names/results only; from Railway logs and variable names): Anthropic answers
`401 invalid x-api-key`; Groq `404 model_not_found` for `llama-3.3-70b-versatile`; Cerebras `402 payment required`; the Qwen and OpenRouter
free slugs `404`; Gemini is rate-limited most of the time. **Paid OpenAI `gpt-4o-mini` is what actually answers.** The model ids are
overridable by env (`GROQ_FREE_MODEL`, `QWEN_FREE_MODEL`, `OPENROUTER_FREE_MODEL`, …) without a redeploy.

## 5. Abuse controls and environment

The brain routes are public (the feeder sends no credentials), so they take bounded input and sit behind a per-caller (keyed IP hash) plus
global sliding-window gate, in the style of the `/api/generate-recipe` limiter. A limited call is `429` with `Retry-After`, which the feeder
treats like any other failure.

- **Bounded input** (`backend/main.py`, `backend/body_limit.py`): bodies over 16 KiB are `413`, enforced in ASGI _before_ FastAPI reads the
  body (a dependency cannot do it — the framework parses the whole body first, and a chunked upload declares no length; a 60 MB chunked POST
  peaked at ~640 MB of memory under the first version). A word-duel rack is 1–26 letters or a map of at most 26 whole tiles (a
  `{letter: count}` map used to be expanded to that many letters — `{"A": 200000000}` cost ~376 MB in 0.04 s); at most 50 candidates of at
  most 15 letters; `context.playerWord` is interpolated into the model prompt, so only `[A-Za-z]{1,15}` survives. Other `POST` routes
  (`/api/chat`, …) have no body cap: that is pre-existing and repo-wide.
- **Errors never echo the exception**: an unexpected failure is `500 {"success": false, "error": "Internal server error."}`; the detail stays in
  the log. The `agentId` persona lookup runs in the thread pool, so a slow database cannot stall the event loop (and `/health`).
- **The Vercel Oracle route** has the same hourly limits through `lib/security/rate-limit.ts`, which is per serverless instance and so
  best-effort. The other three Vercel brain routes (`jing`, `word-duel`, `pillar`) are still unmetered.
- **Client IP**: the gates key on `X-Real-IP` (the header Railway documents its edge as setting), else the first `X-Forwarded-For` hop, else
  the socket peer (`backend/client_ip.py`), capped at 64 characters. **Whether the production edge overwrites `X-Real-IP` has not been
  confirmed**; if it does not, a caller can rotate its own and the global windows are the only backstop. Check once after the deploy by
  sending a request with a forged `X-Real-IP` and looking at the `ip_hash=` in the logs.

| Variable                                                                | Default                                        | Meaning                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BRAIN_ORACLE_PER_CALLER_PER_HOUR` / `BRAIN_ORACLE_GLOBAL_PER_HOUR`     | 120 / 400                                      | the feeder caps itself at 60 questions an hour (both runtimes)                                                                                                                                         |
| `BRAIN_WORD_DUEL_PER_CALLER_PER_MIN` / `BRAIN_WORD_DUEL_GLOBAL_PER_MIN` | 60 / 300                                       | every call may reach a model, and in production the link that answers is paid                                                                                                                          |
| `BRAIN_JING_PER_CALLER_PER_MIN` / `BRAIN_JING_GLOBAL_PER_MIN`           | 120 / 600                                      | deterministic unless an `agentId` asks for a voice                                                                                                                                                     |
| `ORACLE_TIMEOUT_SECONDS` / `ORACLE_PROVIDER_TIMEOUT_SECONDS`            | 12 / 6                                         | overall and per-provider bounds for the Oracle (the Vercel route hard-codes them)                                                                                                                      |
| `WORD_DUEL_TIMEOUT_MS` / `JING_VOICE_TIMEOUT_MS`                        | 2500                                           | model deadline before the deterministic move                                                                                                                                                           |
| `OIDC_SIGNING_KEY_PEM`                                                  | —                                              | RSA private key PEM (≥ 2048 bits); `503 oidc_key_not_configured` / `oidc_key_invalid` without a usable one                                                                                             |
| `OIDC_ALLOWED_ORIGINS`                                                  | —                                              | extra exact origins for `/oidc/token` and `/oidc/session`, beyond `alchm.kitchen` and its subdomains                                                                                                   |
| `OIDC_RATE_PER_CALLER_PER_MIN` / `OIDC_RATE_GLOBAL_PER_MIN`             | 60 / 6000                                      | only calls that reach the kitchen count; cookie-less calls are answered locally. The global window is a deliberately roomy backstop: junk cookies with a plausible name reach the kitchen and spend it |
| `KITCHEN_SESSION_URL` / `KITCHEN_SESSION_TIMEOUT_S`                     | `https://alchm.kitchen/api/auth/session` / 4.0 |                                                                                                                                                                                                        |

A shared secret between the feeders and the brain would let these routes drop the public gate, but it needs a matching Pentacles change
(`feeder/brain.ts` sends no auth header today).

### The issuer's own gates

CORS in `backend/main.py` is `allow_origins=["*"]` with credentials, which reflects any origin. For the two routes that act on a cookie
that is not enough, so `backend/oidc.py` also: refuses (`403`) a browser `Origin` that is not first-party or a localhost dev origin;
answers `401` / `{user: null}` locally when no Auth.js session cookie is present (it used to forward every cookie-less call to
`alchm.kitchen`); rate limits the calls that do reach the kitchen; sends `Cache-Control: no-store`. The token's claims still include
`email`, `name` and `picture`, as the original service's did.

## 6. Reading the live service (measured 2026-10-15 and 2026-10-17)

- Before this change `/oidc/*` and `/.well-known/*` were `404` and `POST /api/agents/{oracle,jing,word-duel,pillar}` `405` on the primary.
  On the Vercel fallback `jing`, `word-duel` and `pillar` answered `400` to an empty body (deployed), `oracle` `405`.
- A browser holding a stored 30-day Pentacles token cannot connect to SpacetimeDB while the JWKS is unreachable, and the client has no
  recovery path: `auth.js` returns early when it already holds a user and never re-mints. SpacetimeDB caches the JWKS for 300 s, so
  recovery after a deploy takes at most about five minutes — **if the signing key is the original one**. The `kid` is derived from the key
  (`VnO8X7GhBBK6CGoL` is not recorded anywhere in Pentacles), so it comes back only with the original `OIDC_SIGNING_KEY_PEM`; after the
  deploy, `GET /.well-known/jwks.json` shows which key is live.
- `GET /api/agents` and `GET /api/agents/<id>` were `500` on the primary: the Neon project is over quota.

## 7. Not done here

- **Pillar** is not served by FastAPI. The deterministic Next.js brain (`app/api/agents/pillar/route.ts`, ~800 lines with its libraries) works
  as the fallback; a Python port would be ~300 lines (a reference exists in `alchm-astro-core/tools/pillar_sim.py`) and was proven
  bit-identical to the TypeScript over 7,280 cases, but it needs `pillars.v1.json` vendored into `backend/`.
- The OIDC token still carries `email`/`name`/`picture`; a 30-day non-revocable bearer in `localStorage` should carry only `iss`/`sub`/`aud`/
  `iat`/`exp`, and the client needs a refresh path before the TTL can shrink. The JWKS has no previous-key slot for a graceful rotation.
- The Oracle's `context` is client-controlled and answers to cacheable questions are stored in a table shared by every player.
- Word duel with no legal candidate is `422` here; the feeder then scores its own fallback as `round(len × 1.5)` and the reducer accepts an
  empty word, so the player wins that duel.

- `pa-rust-backend/` still serves the retired circular-orbit sky: `src/astro/positions.rs` ports the old model and its golden fixture
  (`tests/fixtures/golden_gen.py`) pins it, and its README lists the endpoints as ports of `main.py`. That runtime should move to a real
  ephemeris too, or answer 503 like the Python one.
- `backend/database.py` sets no connect timeout, so a black-holed database pins a worker thread per request for ~2 minutes (the persona lookup
  is off the event loop now, but threads are finite). A bounded `connect_timeout` is global and could affect cold starts: choose it deliberately.
- Python `str.strip()` and JavaScript `trim()` strip slightly different whitespace sets (a few control characters), so the two Oracle brains can
  disagree on an exotic question.

## 8. History

These routes never existed in ASOL; they lived in `gregcastro23/alchm-agents-app`:

- `5b722c06d1bc` (2026-07-02): `backend/duel_brain.py`, the word-duel and jing routes.
- `0473bf7587af` (2026-07-10): `backend/oidc.py`, the oracle route, `PyJWT[crypto]`.
- `bac55c1fbe71` (2026-07-23, PR #51 merge): the last commit with all of it.

A force-push to that repo's `main` on 2026-08-02 (`bac55c1` → `beedf47`) dropped them. ASOL was created on 2026-08-09 from an older line,
and on 2026-09-23 the Railway service was repointed at ASOL `main`, so the routes and the issuer disappeared from production
(404 on `/oidc/*`, 405 on `/api/agents/{oracle,jing,word-duel}`). `backend/duel_brain.py` and `backend/oidc.py` are byte-identical
to the `0473bf7` blobs (git blob ids `d90294b8…` and `78ef0e83…`).
