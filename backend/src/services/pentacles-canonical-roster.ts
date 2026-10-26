/**
 * The agents the Pentacles controller is allowed to publish.
 *
 * `seed_agent_player` writes a row to the SpacetimeDB `agent_chart` table, and Pentacles
 * clients can subscribe to that table. The row carries `birth_unix`, `birth_lat`,
 * `birth_lon`, `time_known`, all ten placements, the ascendant and the midheaven. For a
 * historical figure that is public record. For a *forged vessel* (a user-created agent,
 * `craftedBy: 'philosopher-stone-user'`, written by `/api/create-agent`) it is a person's
 * own birth moment and place, so a vessel must never be seeded.
 *
 * This is an ALLOW-list on purpose. "Is this row user-created?" is not decidable from the
 * row: `craftedBy` and `historicalEra` are only marked by some writers
 * (`/api/philosophers-stone/create` stores `craftedBy: 'philosopher-stone'` - the very value
 * the canonical seed uses - and Python `POST /api/agents` is anonymous, takes a client-chosen
 * `agentId` and stores that same default `craftedBy` with no `historicalEra`), so a
 * deny-list keyed on those columns misses real vessels. An id that is on THIS list is the
 * only positive evidence that a row is a canonical figure.
 *
 * Why a copy and not an import of `HISTORICAL_AGENTS`: the controller ships as its own image
 * (`backend/Dockerfile.controller` copies `prisma/` and `backend/src/` and nothing else), so
 * `lib/` does not exist at runtime. `test/pentacles/controller-forged-vessel-privacy.spec.ts`
 * compares this list to `HISTORICAL_AGENTS` in both directions, so it cannot drift silently:
 * adding a historical agent fails that spec until its id is added here (fail closed - an
 * agent missing from this list is simply not seeded).
 *
 * Planetary-degree and moon sprites are deliberately NOT on this list. Their ids are
 * pattern-shaped (`planetary-sun-aries-12`, `moon-phase-*`), and a pattern is satisfiable by
 * anyone who can write a `historical_agents` row with a chosen `agentId` (Python
 * `POST /api/agents` is that writer today). They are also celestial points with
 * `natalChart: {}`, which the controller already rejects as lacking the ten placements, so
 * allow-listing them would add a forgeable door and no behaviour.
 */
export const CANONICAL_ROSTER_AGENT_IDS: readonly string[] = Object.freeze([
  'adam-smith-1723',
  'albert-einstein',
  'alexander-the-great',
  'archimedes',
  'aristotle',
  'benjamin-franklin',
  'carl-jung',
  'carl-sagan',
  'charles-darwin-1809',
  'charles-dickens-1812',
  'chiron',
  'cicero',
  'claude-monet-1840',
  'cleopatra',
  'confucius',
  'dante-alighieri',
  'david-hume-1711',
  'donatello',
  'edgar-allan-poe-1809',
  'eleanor-roosevelt',
  'emily-dickinson',
  'frida-kahlo',
  'fyodor-dostoevsky',
  'galileo-galilei',
  'geoffrey-chaucer',
  'greg-castro-1991',
  'herodotus',
  'hildegard-of-bingen',
  'homer',
  'ibn-sina-avicenna',
  'immanuel-kant-1724',
  'isaac-asimov',
  'isaac-newton',
  'jane-austen',
  'jean-jacques-rousseau-1712',
  'joan-of-arc',
  'johannes-kepler-1571',
  'john-locke-1632',
  'julius-caesar',
  'lao-tzu',
  'leonardo-da-vinci',
  'lewis-carroll',
  'machiavelli',
  'mahatma-gandhi',
  'marcus-aurelius',
  'marie-curie-1867',
  'mark-twain-1835',
  'mary-wollstonecraft-1759',
  'maya-angelou',
  'michelangelo',
  'murasaki-shikibu',
  'nikola-tesla-1856',
  'oscar-wilde',
  'paulo-freire',
  'petrarch',
  'plato',
  'rachel-carson',
  'raphael',
  'rene-descartes-1596',
  'rumi',
  'siddhartha-gautama-buddha',
  'sigmund-freud-1856',
  'sitting-bull',
  'socrates',
  'sojourner-truth',
  'tecumseh',
  'thomas-aquinas',
  'vincent-van-gogh-1853',
  'voltaire-1694',
  'wangari-maathai',
  'william-shakespeare',
  'wolfgang-mozart',
])
