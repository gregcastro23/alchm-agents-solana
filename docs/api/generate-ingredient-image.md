# POST /api/generate-ingredient-image

Generates a premium culinary reference image for an ingredient using the Nano Banana image provider (`fetchImaginize` → `ASTROLOGIZE_API_BASE/imaginize`). Returns both `url` and `image_url` for WTEN `batchEnrichIngredients` compatibility.

## Request

```
POST /api/generate-ingredient-image
Content-Type: application/json
```

| Field                 | Type     | Required | Description                                                                                       |
| --------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------- |
| `name`                | string   | **yes**  | Ingredient display name                                                                           |
| `ingredient_id`       | string   | no       | Stable ID (used for `storage_path` if no `slug`)                                                  |
| `slug`                | string   | no       | URL-safe slug (preferred key for `storage_path`)                                                  |
| `category`            | string   | no       | Category hint (e.g. `"Spice"`, `"Herb"`, `"Citrus"`)                                              |
| `description`         | string   | no       | First sentence used as a prompt detail                                                            |
| `elementalProperties` | object   | no       | `{ Fire, Water, Earth, Air }` weights 0–1. Dominant elements (> 0.3) add a subtle lighting accent |
| `sensoryProfile`      | object   | no       | Stored for context; not currently reflected in prompt                                             |
| `culinaryProfile`     | object   | no       | Stored for context; not currently reflected in prompt                                             |
| `qualities`           | string[] | no       | Up to 4 descriptive tags appended to the prompt                                                   |

### Example request

```json
{
  "name": "Saffron",
  "slug": "saffron",
  "category": "Spice",
  "description": "The world's most precious spice, harvested from Crocus sativus stigmas.",
  "elementalProperties": {
    "Fire": 0.65,
    "Earth": 0.2,
    "Water": 0.1,
    "Air": 0.05
  },
  "qualities": ["floral", "medicinal", "golden", "delicate"]
}
```

## Response

```json
{
  "url": "https://cdn.alchm.kitchen/ingredients/saffron.png",
  "image_url": "https://cdn.alchm.kitchen/ingredients/saffron.png",
  "provider": "nanobanana",
  "prompt": "premium culinary photograph of Saffron (Spice), the world's most precious spice...",
  "storage_path": "ingredients/saffron.png"
}
```

| Field             | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `url`             | Generated image URL                                              |
| `image_url`       | Same as `url` — second alias for WTEN script compatibility       |
| `provider`        | Always `"nanobanana"`                                            |
| `prompt`          | Final prompt sent to the image provider                          |
| `storage_path`    | Canonical path `ingredients/<slug\|id\|normalized-name>.png`     |
| `fallback`        | Present and `true` when the provider was temporarily unavailable |
| `fallback_reason` | Provider error message when `fallback` is `true`                 |

### Fallback response (provider degraded)

When the image backend is unavailable the endpoint still returns **200** with `fallback: true` so batch scripts can continue:

```json
{
  "url": null,
  "image_url": null,
  "provider": "nanobanana",
  "prompt": "...",
  "storage_path": "ingredients/saffron.png",
  "fallback": true,
  "fallback_reason": "External image service unavailable (503)"
}
```

## Error responses

| Status | Cause                                 |
| ------ | ------------------------------------- |
| 400    | `name` missing or empty               |
| 400    | Request body is not valid JSON        |
| 502    | Provider threw an unrecoverable error |

## Storage path logic

```
slug            → ingredients/{slug}.png
ingredient_id   → ingredients/{ingredient_id}.png  (when no slug)
name            → ingredients/{kebab-name}.png      (when no slug or id)
```

## Image prompt style

The prompt is built in `lib/ingredient-image-generator.ts → buildIngredientPrompt()`:

- Centered on dark slate surface, studio lighting, razor-sharp focus
- Rich natural texture, negative space for card cropping
- Subtle elemental lighting accent (warm amber / cool moisture / earthy tones / airy backlighting) for dominant elements only
- Negative prompt: `text, labels, hands, packaging, watermarks, logos, fantasy elements, excessive blur, cartoon, illustration, painting`

## Provider configuration

The image provider URL is set by `ASTROLOGIZE_API_BASE` (defaults to `https://alchm-backend.onrender.com`). No additional env var is required.

## WTEN batch backfill

After deploying, backfill ingredient images from the WTEN repo:

```bash
PLANETARY_IMAGE_ENDPOINT=https://agents.alchm.kitchen/api/generate-ingredient-image \
  bun run ingredients:batch-enrich --apply --include-images --limit=25 --yes
```

## GET /api/generate-ingredient-image

Returns service metadata and field schema — useful for health checks and discovery.
