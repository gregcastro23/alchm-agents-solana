# Forged vessel privacy (Next.js API layer)

A **forged vessel** is a `historical_agents` row written by `POST /api/create-agent`
(`craftedBy = 'philosopher-stone-user'`, `historicalEra = 'user_created'`). It holds a
person's private data: birth date, time, coordinates and place, the complete natal chart
(every body's sign and degree, the ascendant, the houses), and the free text the owner typed
(about-yourself, life story, poetry, values). Canonical historical figures
(`HISTORICAL_AGENTS`) and the sky-generated planetary/moon agents are public and untouched.

PR #67 redacted `GET /api/agents`. An audit found the doors it left open; this is the
contract that closes them. Code: `lib/agents/forged-privacy.ts` (pure projections),
`lib/agents/public-roster.ts` (which ids are public by construction).

## Who sees what

| Caller                                                                                                   | Birth data, chart, owner text |
| -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Holder of `INTERNAL_API_SECRET` (`Authorization: Bearer`, `X-Internal-Secret`, `X-Sync-Secret`)          | everything                    |
| Admin whose `users.role` is `admin` **in the database** (the session's `role` claim alone is not enough) | everything                    |
| The vessel's creator (`created_agents`)                                                                  | their own vessels             |
| Anyone else, including a wrong secret and a signed-in stranger                                           | the public view below         |

The public view is built by **allow-list**, never by stripping known-bad keys:

- `birthData`: the place **name** only. No date, time, coordinates.
- `natalChart`: `{ planets: { Sun: { sign } } }`.
- `personality.core`: `essence` and `temperament` only. `expression` and `emotion` are
  withheld because the forge overwrites them with the owner's raw about-yourself and values
  text, so a stored value cannot be told from a generated one.
- `appearance.aura`: `type`, `color`, `intensity` (well-typed) only.
- shadows / gifts / challenges / wisdom domains: short strings only. `evolutionValues` and
  `ivSnapshot`: finite numbers under plain keys only.

## Doors and what closes each

| Door                                                                | Closed by                                                                                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/agents` `appearance.aura.sourceCharts`                    | projection above, on every branch (default roster, `?category=planetary`, `?source=backend`); the writer no longer stores charts in `aura`                             |
| `GET /api/agents?source=backend` (Railway rows have no `craftedBy`) | a row is public only if its id is canonical or sky-generated; anything else is a person's                                                                              |
| Shared-cache replay of an entitled answer                           | entitled responses carry `Cache-Control: private, no-store` (+ `CDN-Cache-Control: no-store`); every response carries `Vary: Authorization, Cookie, X-Internal-Secret` |
| `POST/GET /api/agents/unified` CRUD actions                         | `requireAdminOrService`; only `chat`, `interact`, `multi_agent_chat`, `evolve` (501) and GET `health` are public; an action added later is gated by default            |
| `GET /api/agents/[slug]/ratings` -> `/api/feed/stream`              | only a **roster** vessel read under the `'deny'` wallet policy is published to the anonymous stream; never a forged vessel, never an entitled read                     |
| `GET /api/feed` `events[].agent.birthchart`                         | Sun sign only unless the agent is canonical or sky-generated                                                                                                           |
| Error text of `GET /api/agents`                                     | fixed messages; the datastore's message stays in the server log                                                                                                        |

## Run once per environment

Rows written before the writer fix still hold `aura.sourceCharts` (a second, complete copy of
the owner's chart). The readers no longer serve it, but the data stays at rest until:

```bash
DATABASE_URL=... bun run scripts/scrub-forged-aura-charts.ts           # dry-run: counts only
DATABASE_URL=... bun run scripts/scrub-forged-aura-charts.ts --apply   # removes the key
```

Run it against **every** database the app or the Railway backend reads (production, preview,
staging). It refuses to run without `DATABASE_URL`, prints host and database only, and is
idempotent. The chart itself stays in the `natalChart` column.

## Not covered here

The Python backend (`api.agents.alchm.kitchen` `GET/PUT/DELETE /api/agents*`), the Pentacles
controller, and the server-rendered profile page `app/(app)/agent/[id]/page.tsx` are separate
surfaces. `POST /api/agents` (Next) still proxies Railway's create unauthenticated.
