// @vitest-environment node
/** Real catalog/row counterexamples for the production read-only rollout gate. */
import { describe, it } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import path from 'node:path'

const databaseUrl = process.env.FORGE_TEST_DATABASE_URL
const suite = databaseUrl ? describe : describe.skip

suite('forge rollout preflight against disposable PostgreSQL', () => {
  it('rejects incomplete boundaries and rows, then accepts the repaired schema', async () => {
    if (!databaseUrl) throw new Error('FORGE_TEST_DATABASE_URL is required.')
    const url = new URL(databaseUrl)
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/(forge_test[a-z0-9_]*|sql_prepare_gate)$/.test(url.pathname)
    ) {
      throw new Error(
        'Forge tests require a disposable loopback forge_test* or sql_prepare_gate database.'
      )
    }
    const schema = `forge_preflight_${randomUUID().replaceAll('-', '')}`
    const db = new Client({ connectionString: databaseUrl })
    await db.connect()
    let scenarios = 0
    function audit(label: string, status = 1, gate = true) {
      const result = spawnSync(
        'bun',
        [path.resolve('scripts/preflightAgentCreation.ts'), ...(gate ? ['--require-ready'] : [])],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            FORGE_PREFLIGHT_DATABASE_URL: databaseUrl,
            FORGE_PREFLIGHT_DATABASE_SCHEMA: schema,
          },
          encoding: 'utf8',
        }
      )
      assert.equal(result.status, status, `${label}: ${result.stderr} ${result.stdout}`)
      const report = JSON.parse(result.stdout)
      if (status === 1) assert.equal(report.readiness.ready, false, label)
      assert.equal(report.readOnly, true, label)
      scenarios++
      return report
    }
    const index = 'agent_creation_requests_creator_request_key'
    async function replaceIndex(ddl: string) {
      await db.query(`DROP INDEX IF EXISTS "${index}"`)
      await db.query(ddl)
    }
    const goodIndex = `CREATE UNIQUE INDEX "${index}" ON agent_creation_requests ("creatorId","clientRequestId")`
    try {
      await db.query(`CREATE SCHEMA "${schema}"`)
      await db.query(`SET search_path TO "${schema}"`)
      audit('missing table rejected')
      audit('inventory without table remains non-failing', 0, false)
      await db.query(
        await readFile(
          path.resolve(
            'prisma/migrations/20261013000000_add_agent_creation_requests/migration.sql'
          ),
          'utf8'
        )
      )
      assert.equal(audit('applied empty table accepted', 0).readiness.ready, true)
      await db.query(`ALTER INDEX "${index}" RENAME TO unrelated_but_correct_boundary`)
      assert.equal(
        audit('correct differently named index accepted', 0).readiness.uniqueBoundaryVerified,
        true
      )
      await db.query(`ALTER INDEX unrelated_but_correct_boundary RENAME TO "${index}"`)
      await replaceIndex(
        `CREATE INDEX "${index}" ON agent_creation_requests ("creatorId","clientRequestId")`
      )
      audit('same-name nonunique index rejected')
      await replaceIndex(`${goodIndex} WHERE response IS NOT NULL`)
      audit('same-name partial unique index rejected')
      await replaceIndex(
        `CREATE UNIQUE INDEX "${index}" ON agent_creation_requests (lower("creatorId"),"clientRequestId")`
      )
      audit('same-name expression unique index rejected')
      await replaceIndex(
        `CREATE UNIQUE INDEX "${index}" ON agent_creation_requests ("creatorId","clientRequestId","requestHash")`
      )
      audit('same-name widened unique key rejected')
      await replaceIndex(`${goodIndex} INCLUDE ("agentId")`)
      audit('same-name index with extra included column rejected')
      await replaceIndex(goodIndex)
      await db.query(
        'ALTER TABLE agent_creation_requests RENAME COLUMN "requestHash" TO "hiddenHash"'
      )
      assert.equal(audit('missing expected column rejected').readiness.rowAuditAvailable, false)
      await db.query(
        'ALTER TABLE agent_creation_requests RENAME COLUMN "hiddenHash" TO "requestHash"'
      )
      await db.query('ALTER TABLE agent_creation_requests ALTER COLUMN "creatorId" DROP NOT NULL')
      audit('wrong nullability rejected')
      await db.query('ALTER TABLE agent_creation_requests ALTER COLUMN "creatorId" SET NOT NULL')
      await db.query(
        'ALTER TABLE agent_creation_requests ALTER COLUMN "agentId" TYPE integer USING NULL'
      )
      audit('wrong column type rejected')
      await db.query('ALTER TABLE agent_creation_requests ALTER COLUMN "agentId" TYPE text')
      await db.query(
        `INSERT INTO agent_creation_requests(id,"creatorId","clientRequestId","requestHash") VALUES ('fixture','creator','request',$1)`,
        ['a'.repeat(64)]
      )
      audit('incomplete request row rejected')
      await db.query(`UPDATE agent_creation_requests SET "agentId"='agent',response='null'::jsonb`)
      audit('JSON-null completion rejected')
      await db.query(
        `UPDATE agent_creation_requests SET response=$1::jsonb,"requestHash"='broken'`,
        [
          JSON.stringify({
            success: true,
            agent: { id: 'agent', name: 'Fixture', consciousness: { monicaConstant: 1 } },
          }),
        ]
      )
      audit('malformed request hash rejected')
      await db.query(`UPDATE agent_creation_requests SET "requestHash"=$1`, ['a'.repeat(64)])
      assert.equal(audit('complete valid row accepted', 0).readiness.ready, true)
      const validResponse = JSON.stringify({
        success: true,
        agent: { id: 'agent', name: 'Fixture', consciousness: { monicaConstant: 1 } },
      })
      await db.query(`UPDATE agent_creation_requests SET response='{}'::jsonb`)
      assert.equal(audit('malformed response object rejected').requests.invalid_responses, 1)
      await db.query(`UPDATE agent_creation_requests SET response=$1::jsonb`, [validResponse])
      await db.query(
        `UPDATE agent_creation_requests SET response=jsonb_set(response,'{agent,id}','"other-agent"'::jsonb)`
      )
      assert.equal(audit('response agent ID mismatch rejected').requests.invalid_responses, 1)
      await db.query(
        `UPDATE agent_creation_requests SET response=$1::jsonb #- '{agent,consciousness}'`,
        [validResponse]
      )
      assert.equal(audit('missing consciousness rejected').requests.invalid_responses, 1)
      await db.query(
        `UPDATE agent_creation_requests SET response=jsonb_set($1::jsonb,'{agent,consciousness,monicaConstant}','1e1000'::jsonb)`,
        [validResponse]
      )
      assert.equal(
        audit('number outside the finite JavaScript range rejected').requests.invalid_responses,
        1
      )
      await db.query(`UPDATE agent_creation_requests SET response=$1::jsonb`, [validResponse])
      await db.query(`DROP INDEX "${index}"`)
      await db.query(
        `INSERT INTO agent_creation_requests SELECT 'duplicate',"creatorId","clientRequestId","requestHash","agentId",response,"createdAt" FROM agent_creation_requests`
      )
      audit('duplicate key groups rejected')
      await assert.rejects(
        db.query(
          `CREATE UNIQUE INDEX CONCURRENTLY "${index}" ON agent_creation_requests ("creatorId","clientRequestId")`
        ),
        error => error instanceof Error && 'code' in error && error.code === '23505'
      )
      const invalid = audit('failed concurrently-created invalid unique index rejected')
      assert.equal(
        invalid.indexes.find((candidate: { index_name: string }) =>
          candidate.index_name.endsWith(index)
        ).valid,
        false
      )
      await db.query(`DELETE FROM agent_creation_requests WHERE id='duplicate'`)
      await replaceIndex(goodIndex)
      assert.equal(
        audit('repaired valid boundary and completed row accepted', 0).readiness.ready,
        true
      )
      assert.equal(scenarios, 23)
    } finally {
      await db.query('SET search_path TO public')
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await db.end()
    }
  }, 30_000)
})
