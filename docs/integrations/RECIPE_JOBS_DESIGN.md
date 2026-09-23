# Async recipe-generation jobs — design note (not built)

Status: **proposal**, 2026-09-23. Nothing here is implemented. It exists so WTEN's
Phase 3 (QStash-spread prewarm) and a later ASOL job API can be planned together.

## Why

`POST /api/generate-recipe` (Python, `api.agents.alchm.kitchen`) generates synchronously.
WTEN's hourly prewarm (`src/services/agentRecipePrewarm.ts`) calls it up to three times
inside a 60-second Vercel function, giving each call `min(45s, time left)`.

What is measured today:

| Source                                                       | Window                                     | Result                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| WTEN's own logs (brief, 2026-09-22)                          | —                                          | 12–34 s per generation, fastest 13.7 s                                                                               |
| Railway app logs, `alchm-agents-app` deployment `13fe3288`   | 2026-09-21 10:00 → 09-23 07:00 UTC (~45 h) | 173 requests: 172 × 200, 1 × 502 (0.6 %). **No timings** — that code logged none, and its HTTP logs are not retained |
| Railway app logs, this repo's `main` (deployment `cd63fd82`) | since 2026-09-23 07:19 UTC                 | 1 generation: 25.0 s (Gemini, second attempt after a validation retry)                                               |

Going forward, `backend/recipe_metrics.py` keeps a per-process window and `/admin/recipes`
shows p50 / p95 / error rate against WTEN's 45 s budget. A p95 near 45 s means the
synchronous contract is the bottleneck, not WTEN's scheduling.

## Shape

```
POST /api/generate-recipe/jobs
  Authorization: Bearer $INTERNAL_API_SECRET
  Idempotency-Key: prewarm:{agentId}:{hourSlot}        # caller's stable ID
  body: the same CosmicRecipeRequest as today, plus optional { callbackUrl }
→ 202 { jobId, status: "queued", statusUrl }           # same jobId for a repeated key
→ 200 { jobId, status: "done", recipe }                # if a cached recipe already answers it

GET /api/generate-recipe/jobs/{jobId}                    # polling fallback
→ 200 { jobId, status: queued|running|done|failed, recipe?, error?, timings }

Callback (when callbackUrl is set) — Standard Webhooks, signed with HOOK_SECRET_ASOL (A4):
  POST {callbackUrl}
  webhook-id: {jobId}:{status}         webhook-timestamp: …     webhook-signature: v1,…
  body: { type: "recipe.generated" | "recipe.failed", jobId, requestHash, recipe?, error?, timings }
```

- **Idempotency.** `jobId` is derived from the caller's `Idempotency-Key` (hash), so a
  retried create returns the same job. Callbacks are at-least-once with a stable
  `webhook-id`; WTEN's `webhook_events` inbox (#868) dedupes them.
- **Storage.** A `recipe_jobs` table (id, request_hash, status, attempts, result jsonb,
  error, created/started/finished_at, callback_attempts, callback_status). Needs `db push`.
- **Execution.** A bounded worker pool inside the Python service (or a separate Railway
  worker), N concurrent jobs to respect provider rate limits, a per-job deadline
  (e.g. 120 s) and one provider-chain retry — the same waterfall as today.
- **Callback delivery.** The shared retry policy from `lib/wten/delivery.ts`, ported:
  retry timeouts, 5xx, 429 and `409 {status:"in_flight"}`; stop on other 4xx; back off
  up to a day; record every attempt (the Python analogue of `wten_deliveries`).

## Rollout

1. ASOL ships the jobs endpoints behind a flag; the synchronous endpoint is unchanged.
2. WTEN Phase 3 spreads the prewarm with QStash (one message per agent) — still synchronous.
3. WTEN switches prewarm to `POST …/jobs` with a callback to `/api/hooks/asol`, keeping
   the polling URL as a fallback.
4. After a week of clean callbacks, WTEN drops the synchronous prewarm path.

## Open questions

- Should cache hits return 200 immediately (proposed) or still go through a job?
- Where does the worker run — in-process (simplest, lost on deploy) or a separate
  Railway service with the table as the queue (survives deploys)?
- Does WTEN want `recipe.failed` callbacks, or only successes plus polling?
