# Mission: Populate Ingredient Card Images (WTEN)

**Repo:** alchm.kitchen / WTEN frontend  
**Trigger:** Run this mission in the WTEN repository root.  
**Goal:** Generate and persist a premium culinary image for every ingredient that is
missing one, then verify they render correctly on the ingredients page.  
**Image provider:** `POST https://agents.alchm.kitchen/api/generate-ingredient-image`  
**Completion signal:** Every ingredient record has a non-null `image_url`; the
`/ingredients` page renders card images with no broken placeholders.

---

## 0 — Before you start: orient yourself

Read these files before touching anything:

1. `scripts/batchEnrichIngredients.ts` — the primary batch driver. Understand its
   `--include-images`, `--apply`, `--limit`, and `--yes` flags and what it writes
   back to the database / API.
2. The Ingredient model (Prisma schema or wherever the type is defined) — confirm
   that `image_url` (or equivalent field) exists and is nullable. If the field does
   not exist, add it as a nullable `String` in the schema and migrate before
   proceeding.
3. The ingredients page component — find where `image_url` is consumed in the card
   UI. Confirm it falls back to a placeholder when null so the page never breaks.
4. `.env.local` (or `.env`) — confirm `PLANETARY_IMAGE_ENDPOINT` is either already
   set or needs to be added (see §1).

Do not skip this orientation step. The mission depends on what the batch script
actually does, not on assumptions.

---

## 1 — Environment

Add to `.env.local` if not already present:

```
PLANETARY_IMAGE_ENDPOINT=https://agents.alchm.kitchen/api/generate-ingredient-image
```

**Verify the endpoint is reachable before running the batch:**

```bash
curl -s -X GET https://agents.alchm.kitchen/api/generate-ingredient-image | jq .
```

Expected: `{ "service": "Ingredient Image Generator", "provider": "nanobanana", ... }`

If the GET returns a 502 or network error, stop and report — the backend must be
deployed before this mission can proceed.

---

## 2 — Smoke test (one ingredient, dry run)

Pick the first ingredient by ID or slug and run a single generation manually to
confirm the full round-trip works:

```bash
curl -s -X POST https://agents.alchm.kitchen/api/generate-ingredient-image \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Saffron",
    "slug": "saffron",
    "category": "Spice",
    "elementalProperties": { "Fire": 0.65, "Earth": 0.20, "Water": 0.10, "Air": 0.05 }
  }' | jq .
```

**Required response shape:**

```json
{
  "url": "https://...",
  "image_url": "https://...",
  "provider": "nanobanana",
  "prompt": "premium culinary photograph of Saffron ...",
  "storage_path": "ingredients/saffron.png"
}
```

If `url` is null and `fallback: true` is present, the image backend is degraded —
wait and retry; do not run the full batch against a degraded provider.

---

## 3 — Request payload contract

The endpoint accepts this shape. All fields except `name` are optional.

```typescript
interface IngredientImageRequest {
  name: string // required — display name
  ingredient_id?: string // preferred stable key for storage_path
  slug?: string // URL-safe slug (used first for storage_path)
  category?: string // e.g. "Herb", "Spice", "Citrus", "Allium"
  description?: string // first sentence used in prompt; keep < 120 chars
  elementalProperties?: {
    Fire?: number // 0–1 weights; values > 0.3 add a lighting accent
    Water?: number
    Earth?: number
    Air?: number
  }
  qualities?: string[] // up to 4 descriptive tags ("earthy", "bitter", …)
  sensoryProfile?: object // passed through for future prompt expansion
  culinaryProfile?: object // passed through for future prompt expansion
}
```

**Populate as many optional fields as the ingredient record has.** Richer input
produces better prompts. At minimum always send `name` + `slug` or `ingredient_id`.

---

## 4 — Batch strategy

### 4a — Use the existing batch script

```bash
PLANETARY_IMAGE_ENDPOINT=https://agents.alchm.kitchen/api/generate-ingredient-image \
  bun run ingredients:batch-enrich \
  --apply \
  --include-images \
  --limit 25 \
  --yes
```

Run this repeatedly until the script reports zero ingredients remaining without
an `image_url`. After each run, inspect the output for:

- `✓ generated` lines — success, image URL written back
- `⚠ fallback` / `fallback: true` — provider was degraded for that item; re-queue it
- `✗ error` — request validation failure; fix the payload and re-run for that slug

### 4b — If the batch script does not support `--include-images`

Check whether the flag exists. If it does not, add it:

1. In `scripts/batchEnrichIngredients.ts`, after the existing enrichment logic,
   add an `images` step that:
   - Queries all ingredients where `image_url IS NULL` (or equivalent)
   - For each, calls the endpoint with the full payload (§3)
   - Writes `image_url` back to the record via the existing persistence layer
     (Prisma `update` / API PATCH — whichever the script already uses for other
     fields)
   - Logs `✓ {slug}` on success, `⚠ fallback {slug}` when the response has
     `fallback: true`, and `✗ {slug}: {error}` on non-2xx

2. Gate the step behind `--include-images` so existing runs are unaffected.
3. Respect `--limit` to cap requests per run.
4. Add a 300 ms delay between requests (`await new Promise(r => setTimeout(r, 300))`)
   to avoid overloading the image backend.

### 4c — Concurrency limit

**Do not run more than 3 image generation requests in parallel.** The backend
uses a shared image generation queue. Sequential or low-concurrency batches are
fine.

---

## 5 — Fallback and retry handling

The endpoint returns `200` with `fallback: true` when the image backend is
temporarily unavailable. The batch script must:

1. Not write `null` into `image_url` when `fallback: true` — leave the field
   unchanged so the item stays in the queue for the next run.
2. Log the fallback with the `fallback_reason` from the response.
3. After a full pass, if more than 20 % of items returned fallbacks, wait 60 s and
   retry that subset before exiting.

On a `502` HTTP response (unrecoverable), skip the item, log the error, and
continue. Do not abort the entire batch.

---

## 6 — Writing image_url back

Use whatever persistence layer the script already uses for other fields (Prisma
direct, internal API, etc.). The field to write is `image_url` (check the actual
column name in the schema — it may be `imageUrl` in Prisma camelCase).

```typescript
// Prisma example
await prisma.ingredient.update({
  where: { slug: ingredient.slug },
  data: { imageUrl: result.image_url },
})
```

If the schema does not yet have this field:

```
npx prisma migrate dev --name add-ingredient-image-url
```

---

## 7 — Frontend verification

After the batch completes, start the dev server and open `/ingredients` in the
browser:

```bash
bun dev
# open http://localhost:3000/ingredients
```

Check for:

- [ ] Every card shows a real image (not a grey placeholder or broken img tag)
- [ ] Cards with `image_url` still null show the placeholder gracefully — no layout
      break, no console error
- [ ] Images load fast (they are hosted CDN URLs — no proxying through WTEN)
- [ ] Dark background of the alchemical UI contrasts well against the image content
      (images are generated on dark slate — they should fit)
- [ ] No ingredient card is missing its name, category, or other text because the
      image is too large

If any card breaks the layout, inspect the `<img>` component and add
`object-fit: cover` or constrain the image to the card dimensions if not already
done.

---

## 8 — Success criteria

The mission is complete when all of the following are true:

1. `SELECT COUNT(*) FROM ingredients WHERE image_url IS NULL` returns 0
   (or the API equivalent returns an empty list of unimaged ingredients).
2. The `/ingredients` page renders without console errors and every card has a
   visible image.
3. A spot-check of 5 random ingredient cards shows images that are:
   - Clearly the correct ingredient (not a generic photo)
   - Centered with visible texture on a dark background
   - Not showing text, watermarks, or hands

---

## 9 — Env vars summary

| Variable                   | Value                                                        | Where        |
| -------------------------- | ------------------------------------------------------------ | ------------ |
| `PLANETARY_IMAGE_ENDPOINT` | `https://agents.alchm.kitchen/api/generate-ingredient-image` | `.env.local` |
| `WHATTOEATNEXT_BASE_URL`   | `https://whattoeatnext-production.up.railway.app`            | already set  |
| `DATABASE_URL`             | existing Prisma connection                                   | already set  |

No new secrets are required. The image endpoint has no API key (rate limiting is
handled server-side by the planetary-agents deployment).

---

## 10 — Rollback

If generated images look wrong (wrong subject, watermarked, broken URL):

1. Run a targeted re-generation for affected slugs by calling the endpoint with a
   richer payload (add `description`, `qualities`, `elementalProperties`).
2. To clear all generated images and restart: `UPDATE ingredients SET image_url = NULL`
   then re-run the batch. This is safe — the endpoint is idempotent per slug.

---

## Reference

- **Endpoint source:** `app/api/generate-ingredient-image/route.ts` in the
  `planetary_agents` repo
- **Lib:** `lib/ingredient-image-generator.ts` — `buildIngredientPrompt`,
  `resolveStoragePath`, `extractImageUrl`
- **API doc:** `docs/api/generate-ingredient-image.md` in the `planetary_agents` repo
- **Storage path pattern:** `ingredients/{slug || ingredient_id || kebab(name)}.png`
- **Provider:** Nano Banana via `ASTROLOGIZE_API_BASE/imaginize`
  (default: `https://alchm-backend.onrender.com`)
