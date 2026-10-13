/**
 * Read-only forge rollout audit. Prints aggregate counts and schema metadata,
 * never request bodies, creator IDs, agent IDs, credentials, or responses.
 *
 * FORGE_PREFLIGHT_DATABASE_URL=... bun scripts/preflightAgentCreation.ts
 * Add --require-ready to fail unless the keyed forge schema and rows are ready.
 * FORGE_PREFLIGHT_DATABASE_SCHEMA defaults to public. No DATABASE_URL fallback:
 * ordinary local checks must never silently connect to a shared database.
 */
import { Client } from 'pg'
import { ForgeSuccessSchema } from '../lib/agents/forge-client'

const connectionString = process.env.FORGE_PREFLIGHT_DATABASE_URL
const schema = process.env.FORGE_PREFLIGHT_DATABASE_SCHEMA || 'public'
const requireReady = process.argv.includes('--require-ready')
const expectedColumns = [
  { name: 'id', type: 'text', nullable: 'NO' },
  { name: 'creatorId', type: 'text', nullable: 'NO' },
  { name: 'clientRequestId', type: 'text', nullable: 'NO' },
  { name: 'requestHash', type: 'text', nullable: 'NO' },
  { name: 'agentId', type: 'text', nullable: 'YES' },
  { name: 'response', type: 'jsonb', nullable: 'YES' },
  { name: 'createdAt', type: 'timestamp without time zone', nullable: 'NO' },
]
if (!connectionString) {
  console.error('FORGE_PREFLIGHT_DATABASE_URL is required; no database was contacted.')
  process.exit(2)
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
  console.error('FORGE_PREFLIGHT_DATABASE_SCHEMA must be a plain PostgreSQL identifier.')
  process.exit(2)
}

const client = new Client({ connectionString })
const quotedSchema = `"${schema}"`
const requestTable = `${quotedSchema}."agent_creation_requests"`
try {
  await client.connect()
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await client.query("SET LOCAL statement_timeout = '30s'")
  const relations = await client.query<{
    historical: string | null
    ownership: string | null
    requests: string | null
  }>(
    `SELECT to_regclass($1)::text AS historical,
            to_regclass($2)::text AS ownership,
            to_regclass($3)::text AS requests`,
    [`${quotedSchema}."historical_agents"`, `${quotedSchema}."created_agents"`, requestTable]
  )
  const relation = relations.rows[0]
  if (!relation) throw new Error('Database returned no relation audit.')

  const legacy = relation.historical
    ? (
        await client.query<{ agents: number }>(
          `SELECT count(*)::int AS agents FROM ${quotedSchema}."historical_agents"`
        )
      ).rows[0]
    : null
  const ownership =
    relation.ownership && relation.historical
      ? (
          await client.query<{
            rows: number
            missing_creator: number
            missing_agent_reference: number
            orphan_agent_reference: number
            repeated_agent_references: number
          }>(`SELECT
            count(*)::int AS rows,
            count(*) FILTER (WHERE c."creatorId" IS NULL)::int AS missing_creator,
            count(*) FILTER (WHERE nullif(c.blueprint->>'agentId', '') IS NULL)::int
              AS missing_agent_reference,
            count(*) FILTER (
              WHERE nullif(c.blueprint->>'agentId', '') IS NOT NULL
                AND h."agentId" IS NULL
            )::int AS orphan_agent_reference,
            (SELECT count(*)::int FROM (
              SELECT blueprint->>'agentId' FROM ${quotedSchema}."created_agents"
               WHERE nullif(blueprint->>'agentId', '') IS NOT NULL
               GROUP BY blueprint->>'agentId' HAVING count(*) > 1
            ) duplicates) AS repeated_agent_references
            FROM ${quotedSchema}."created_agents" c
            LEFT JOIN ${quotedSchema}."historical_agents" h
              ON h."agentId" = c.blueprint->>'agentId'`)
        ).rows[0]
      : null

  const columns = await client.query<{
    column_name: string
    data_type: string
    is_nullable: string
  }>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'agent_creation_requests'
      ORDER BY ordinal_position`,
    [schema]
  )
  const indexes = await client.query<{
    index_name: string
    unique: boolean
    valid: boolean
    ready: boolean
    partial: boolean
    expression: boolean
    key_count: number
    attribute_count: number
    columns: Array<string | null>
    definition: string
  }>(
    `SELECT i.indexrelid::regclass::text AS index_name,
            i.indisunique AS unique, i.indisvalid AS valid, i.indisready AS ready,
            i.indpred IS NOT NULL AS partial, i.indexprs IS NOT NULL AS expression,
            i.indnkeyatts::int AS key_count, i.indnatts::int AS attribute_count,
            ARRAY(SELECT a.attname::text
                    FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
                    LEFT JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   ORDER BY k.position) AS columns,
            pg_get_indexdef(i.indexrelid) AS definition
       FROM pg_index i WHERE i.indrelid = to_regclass($1)
       ORDER BY i.indexrelid::regclass::text`,
    [requestTable]
  )
  const problems: string[] = []
  if (!relation.requests) problems.push('agent_creation_requests is absent.')
  let rowAuditAvailable = Boolean(relation.requests)
  for (const expected of expectedColumns) {
    const actual = columns.rows.find(column => column.column_name === expected.name)
    if (!actual) {
      problems.push(`Required column ${expected.name} is absent.`)
      rowAuditAvailable = false
      continue
    }
    if (actual.data_type !== expected.type) {
      problems.push(
        `Column ${expected.name} has type ${actual.data_type}; expected ${expected.type}.`
      )
      rowAuditAvailable = false
    }
    if (actual.is_nullable !== expected.nullable) {
      problems.push(
        `Column ${expected.name} has nullable=${actual.is_nullable}; expected ${expected.nullable}.`
      )
    }
  }
  // Inspect the indexed attributes, not its name or the text of its DDL. A
  // similarly named partial/expression/widened index does not enforce the key.
  const uniqueBoundaryVerified = indexes.rows.some(
    index =>
      index.unique &&
      index.valid &&
      index.ready &&
      !index.partial &&
      !index.expression &&
      index.key_count === 2 &&
      index.attribute_count === 2 &&
      index.columns[0] === 'creatorId' &&
      index.columns[1] === 'clientRequestId'
  )
  if (!uniqueBoundaryVerified) {
    problems.push(
      'A valid, ready, non-partial unique index on exactly (creatorId, clientRequestId) is absent.'
    )
  }
  const requests = rowAuditAvailable
    ? (
        await client.query<{
          rows: number
          incomplete: number
          malformed_hashes: number
          duplicate_key_groups: number
          invalid_responses: number
        }>(`SELECT count(*)::int AS rows,
            count(*) FILTER (
              WHERE response IS NULL OR jsonb_typeof(response) IS DISTINCT FROM 'object'
                 OR nullif("agentId", '') IS NULL
            )::int AS incomplete,
            count(*) FILTER (
              WHERE "requestHash" IS NULL OR "requestHash" !~ '^[a-f0-9]{64}$'
            )::int AS malformed_hashes,
            0::int AS invalid_responses,
            (SELECT count(*)::int FROM (
              SELECT "creatorId", "clientRequestId" FROM ${requestTable}
              GROUP BY "creatorId", "clientRequestId" HAVING count(*) > 1
            ) duplicates) AS duplicate_key_groups
            FROM ${requestTable}`)
      ).rows[0]
    : null
  if (requests) {
    // Use the same runtime reader as replay. The cursor bounds memory while
    // keeping response bodies and IDs entirely inside this read-only process.
    // Only the aggregate invalid count is emitted below.
    await client.query(`DECLARE forge_response_audit NO SCROLL CURSOR FOR
      SELECT response, "agentId" AS agent_id FROM ${requestTable}`)
    while (true) {
      const page = await client.query<{ response: unknown; agent_id: string | null }>(
        'FETCH FORWARD 250 FROM forge_response_audit'
      )
      if (page.rows.length === 0) break
      for (const row of page.rows) {
        const parsed = ForgeSuccessSchema.safeParse(row.response)
        if (!parsed.success || parsed.data.agent.id !== row.agent_id) {
          requests.invalid_responses++
        }
      }
    }
    await client.query('CLOSE forge_response_audit')
    for (const metric of [
      'incomplete',
      'malformed_hashes',
      'duplicate_key_groups',
      'invalid_responses',
    ] as const) {
      if (requests[metric] > 0)
        problems.push(`Request row audit found ${requests[metric]} ${metric}.`)
    }
  }
  await client.query('ROLLBACK')
  console.log(
    JSON.stringify(
      {
        readOnly: true,
        schema,
        legacy,
        ownership,
        legacyKeys:
          'Previous forge rows have no clientRequestId; no safe automatic backfill exists.',
        requestTableExists: Boolean(relation.requests),
        columns: columns.rows,
        indexes: indexes.rows,
        requests,
        readiness: {
          ready: problems.length === 0,
          uniqueBoundaryVerified,
          rowAuditAvailable,
          problems,
        },
      },
      null,
      2
    )
  )
  if (requireReady && problems.length > 0) process.exitCode = 1
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Forge preflight failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await client.end()
}
