import { afterEach, describe, expect, it } from 'vitest'
import {
  GET as getMuseConnector,
  OPTIONS as optionsMuseConnector,
} from '@/app/.well-known/muse/connector.json/route'
import { GET as getOauthAuthServer } from '@/app/.well-known/oauth-authorization-server/route'
import { GET as getOauthProtectedResource } from '@/app/.well-known/oauth-protected-resource/route'
import {
  DELETE as deleteMcp,
  GET as getMcp,
  OPTIONS as optionsMcp,
  POST as postMcp,
} from '@/app/api/mcp/route'
import { redactSensitiveString } from '@/lib/mcp/httpSecurity'

function createJsonRpcPost(body: unknown, headers: Record<string, string> = {}): Request {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://agents.alchm.kitchen/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: serialized,
  })
}

describe('Planetary Agents MCP Gateway (/api/mcp) & Shared serverFactory v1.5.0', () => {
  const originalOauthEnv = process.env.ENABLE_MCP_OAUTH

  afterEach(() => {
    if (originalOauthEnv === undefined) {
      delete process.env.ENABLE_MCP_OAUTH
    } else {
      process.env.ENABLE_MCP_OAUTH = originalOauthEnv
    }
  })

  describe('1. Stateless Streamable HTTP Security & Transport Guards', () => {
    it('returns 405 Method Not Allowed with Allow: POST, OPTIONS on GET and DELETE', async () => {
      const getRes = await getMcp(
        new Request('https://agents.alchm.kitchen/api/mcp', { method: 'GET' })
      )
      expect(getRes.status).toBe(405)
      expect(getRes.headers.get('allow')).toBe('POST, OPTIONS')
      const getBody = await getRes.json()
      expect(getBody.error.data.errorCode).toBe('METHOD_NOT_ALLOWED')
      expect(getBody.error.data.remediation).toContain('POST')

      const delRes = await deleteMcp(
        new Request('https://agents.alchm.kitchen/api/mcp', { method: 'DELETE' })
      )
      expect(delRes.status).toBe(405)
      expect(delRes.headers.get('allow')).toBe('POST, OPTIONS')
    })

    it('enforces the 256 KB payload size cap (413 Payload Too Large)', async () => {
      const oversizedPayload = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'list_planetary_agents',
          arguments: { padding: 'x'.repeat(270 * 1024) },
        },
      })

      const res = await postMcp(createJsonRpcPost(oversizedPayload))
      expect(res.status).toBe(413)
      const body = await res.json()
      expect(body.error.data.errorCode).toBe('PAYLOAD_TOO_LARGE')
      expect(body.error.data.remediation).toContain('256 KB')
    })

    it('rejects untrusted Origin on OPTIONS preflight with 403 and allows trusted Meta Muse & Alchm origins', async () => {
      const evilOptions = await optionsMcp(
        new Request('https://agents.alchm.kitchen/api/mcp', {
          method: 'OPTIONS',
          headers: { Origin: 'https://evil-phishing.example.com' },
        })
      )
      expect(evilOptions.status).toBe(403)

      const museOptions = await optionsMcp(
        new Request('https://agents.alchm.kitchen/api/mcp', {
          method: 'OPTIONS',
          headers: { Origin: 'https://platform.muse.ai' },
        })
      )
      expect(museOptions.status).toBe(204)
      expect(museOptions.headers.get('access-control-allow-origin')).toBe(
        'https://platform.muse.ai'
      )
    })

    it('allows server-to-server POST requests without an Origin header and redacts tokens in logs', async () => {
      const res = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 100,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test-client', version: '1.0.0' },
          },
        })
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.result.serverInfo.name).toBe('pa-mcp')
      expect(json.result.serverInfo.version).toBe('1.5.0')
      expect(json.result.capabilities).toMatchObject({
        tools: {},
        prompts: {},
        resources: {},
        completions: {},
      })

      const redacted = redactSensitiveString(
        'Failed with Bearer sk_alchm_pro_99887766 and apiKey=pa_live_secret123'
      )
      expect(redacted).not.toContain('sk_alchm_pro_99887766')
      expect(redacted).not.toContain('pa_live_secret123')
      expect(redacted).toContain('[REDACTED]')
    })
  })

  describe('2. Full MCP Triad + RFC 6570 Resource Templates + Autocomplete', () => {
    it('exposes all 8 Planetary Agent tools with honest readOnlyHint annotations', async () => {
      const res = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 201,
          method: 'tools/list',
          params: {},
        })
      )
      expect(res.status).toBe(200)
      const { result } = await res.json()
      expect(result.tools).toHaveLength(8)

      const byName = Object.fromEntries(
        result.tools.map((t: { name: string; annotations: Record<string, boolean> }) => [
          t.name,
          t.annotations,
        ])
      )

      // Zero-cost deterministic read/computation tools
      expect(byName.match_historical_mentor.readOnlyHint).toBe(true)
      expect(byName.inspect_agent_pvr_telemetry.readOnlyHint).toBe(true)
      expect(byName.simulate_agent_dialogue.readOnlyHint).toBe(true)
      expect(byName.get_caller_allowance.readOnlyHint).toBe(true)
      expect(byName.list_planetary_agents.readOnlyHint).toBe(true)

      // Paid / ESMS-metered or state-mutating tools
      expect(byName.convene_agent_council.readOnlyHint).toBe(false)
      expect(byName.chat_with_planetary_agent.readOnlyHint).toBe(false)
      expect(byName.trigger_chart_specific_jing_duel.readOnlyHint).toBe(false)
    })

    it('lists and reads all 4 static resources', async () => {
      const listRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 202,
          method: 'resources/list',
          params: {},
        })
      )
      const listJson = await listRes.json()
      const uris = listJson.result.resources.map((r: { uri: string }) => r.uri)
      expect(uris).toEqual([
        'agents://roster/historical',
        'agents://ontology/pvr-ratings',
        'agents://sky/current-transits',
        'agents://bridge/culinary-kitchen',
      ])

      for (const uri of uris) {
        const readRes = await postMcp(
          createJsonRpcPost({
            jsonrpc: '2.0',
            id: 203,
            method: 'resources/read',
            params: { uri },
          })
        )
        expect(readRes.status).toBe(200)
        const readJson = await readRes.json()
        const parsed = JSON.parse(readJson.result.contents[0].text)
        expect(parsed.ok).toBe(true)
      }
    })

    it('lists and resolves RFC 6570 resource templates (agents://persona/{slug} and agents://sanctum/{slug}) with alias & didYouMean support', async () => {
      const tplRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 204,
          method: 'resources/templates/list',
          params: {},
        })
      )
      const tplJson = await tplRes.json()
      expect(
        tplJson.result.resourceTemplates.map((t: { uriTemplate: string }) => t.uriTemplate)
      ).toEqual(['agents://persona/{slug}', 'agents://sanctum/{slug}'])

      // Alias resolution: 'jung' -> 'carl-jung'
      const jungRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 205,
          method: 'resources/read',
          params: { uri: 'agents://persona/jung' },
        })
      )
      const jungPayload = JSON.parse((await jungRes.json()).result.contents[0].text)
      expect(jungPayload.ok).toBe(true)
      expect(jungPayload.canonicalId).toBe('carl-jung')
      expect(jungPayload.pvrTelemetry.ovr).toBeGreaterThanOrEqual(25)
      expect(jungPayload.pvrTelemetry.ovr).toBeLessThanOrEqual(99)

      // Fuzzy didYouMean on typo
      const typoRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 206,
          method: 'resources/read',
          params: { uri: 'agents://persona/keplerr' },
        })
      )
      const typoPayload = JSON.parse((await typoRes.json()).result.contents[0].text)
      expect(typoPayload.ok).toBe(false)
      expect(typoPayload.errorCode).toBe('PERSONA_NOT_FOUND')
      expect(typoPayload.didYouMean).toContain('johannes-kepler')
      expect(typoPayload.remediation).toBeTruthy()

      // Sanctum template
      const sanctumRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 207,
          method: 'resources/read',
          params: { uri: 'agents://sanctum/monica-tarot' },
        })
      )
      const sanctumPayload = JSON.parse((await sanctumRes.json()).result.contents[0].text)
      expect(sanctumPayload.ok).toBe(true)
      expect(sanctumPayload.slug).toBe('monica-tarot')
      expect(sanctumPayload.residentAgents.length).toBeGreaterThan(0)
    })

    it('lists and renders all 3 high-signal prompts and supports completion/complete', async () => {
      const promptListRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 208,
          method: 'prompts/list',
          params: {},
        })
      )
      const promptNames = (await promptListRes.json()).result.prompts.map(
        (p: { name: string }) => p.name
      )
      expect(promptNames).toEqual([
        'mentor_match_consultation',
        'multi_agent_symposium',
        'natal_sky_biwheel_reading',
      ])

      const promptGetRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 209,
          method: 'prompts/get',
          params: {
            name: 'mentor_match_consultation',
            arguments: {
              dilemmaOrTopic: 'navigating creative synthesis under Saturnian discipline',
              element: 'Earth',
              agentSlug: 'johannes-kepler',
            },
          },
        })
      )
      const promptGetJson = await promptGetRes.json()
      expect(promptGetJson.result.messages[0].content.text).toContain('johannes-kepler')

      // Autocomplete on resource template agents://persona/{slug}
      const completePersonaRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 210,
          method: 'completion/complete',
          params: {
            ref: { type: 'ref/resource', uri: 'agents://persona/{slug}' },
            argument: { name: 'slug', value: 'kep' },
          },
        })
      )
      const completePersonaJson = await completePersonaRes.json()
      expect(completePersonaJson.result.completion.values).toContain('johannes-kepler')

      // Autocomplete on prompt argument element
      const completeElementRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 211,
          method: 'completion/complete',
          params: {
            ref: { type: 'ref/prompt', name: 'mentor_match_consultation' },
            argument: { name: 'element', value: 'fi' },
          },
        })
      )
      const completeElementJson = await completeElementRes.json()
      expect(completeElementJson.result.completion.values).toEqual(['Fire'])
    })
  })

  describe('3. Planetary Agent Domain Tools, Self-Healing Envelopes & PR #98 Boundary', () => {
    it('executes match_historical_mentor with Natal-Sky Bi-Wheel resonance and PVR ratings', async () => {
      const res = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 301,
          method: 'tools/call',
          params: {
            name: 'match_historical_mentor',
            arguments: {
              query: 'harmonic geometry and celestial mechanics',
              element: 'Earth',
              limit: 3,
            },
          },
        })
      )
      const json = await res.json()
      const payload = json.result.structuredContent
      expect(payload.ok).toBe(true)
      expect(payload.mentors).toHaveLength(3)
      expect(payload.mentors[0].pvr).toBeGreaterThanOrEqual(25)
      expect(payload.mentors[0].pvr).toBeLessThanOrEqual(99)
      expect(payload.surgeState).toBeDefined()
    })

    it('executes inspect_agent_pvr_telemetry with multi-agent head-to-head zone contest', async () => {
      const res = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 302,
          method: 'tools/call',
          params: {
            name: 'inspect_agent_pvr_telemetry',
            arguments: {
              agentSlugs: ['johannes-kepler', 'socrates'],
              contestZoneId: 1,
            },
          },
        })
      )
      const json = await res.json()
      const payload = json.result.structuredContent
      expect(payload.ok).toBe(true)
      expect(payload.vessels).toHaveLength(2)
      expect(payload.vessels[0].esmsDiamond).toBeDefined()
      expect(payload.zoneContest).toBeDefined()
      expect(payload.zoneContest.zoneId).toBe(1)
    })

    it('executes simulate_agent_dialogue and convene_agent_council with idempotency replay', async () => {
      const simRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 303,
          method: 'tools/call',
          params: {
            name: 'simulate_agent_dialogue',
            arguments: {
              agentSlugs: ['socrates', 'rumi'],
              topic: 'the nature of eros and divine knowledge',
            },
          },
        })
      )
      const simPayload = (await simRes.json()).result.structuredContent
      expect(simPayload.ok).toBe(true)
      expect(simPayload.perspectives).toHaveLength(2)
      expect(simPayload.synastryChords.length).toBeGreaterThan(0)

      const councilReq = {
        jsonrpc: '2.0',
        id: 304,
        method: 'tools/call',
        params: {
          name: 'convene_agent_council',
          arguments: {
            agentSlugs: ['johannes-kepler', 'carl-jung', 'hildegard-of-bingen'],
            topic: 'archetypes as harmonic ratios in nature',
            _meta: { idempotencyKey: 'council-idem-key-001' },
          },
        },
      }

      const firstRes = await postMcp(createJsonRpcPost(councilReq))
      const firstPayload = (await firstRes.json()).result.structuredContent
      expect(firstPayload.ok).toBe(true)
      expect(firstPayload.billing.replayed).toBe(false)

      const secondRes = await postMcp(createJsonRpcPost(councilReq))
      const secondPayload = (await secondRes.json()).result.structuredContent
      expect(secondPayload.ok).toBe(true)
      expect(secondPayload.billing.replayed).toBe(true)
    })

    it('bridges HTTP Authorization: Bearer into get_caller_allowance and rejects conflicting credentials', async () => {
      const authRes = await postMcp(
        createJsonRpcPost(
          {
            jsonrpc: '2.0',
            id: 305,
            method: 'tools/call',
            params: {
              name: 'get_caller_allowance',
              arguments: {},
            },
          },
          { Authorization: 'Bearer sk_alchm_pro_testkey99' }
        )
      )
      const authPayload = (await authRes.json()).result.structuredContent
      expect(authPayload.ok).toBe(true)
      expect(authPayload.authenticated).toBe(true)
      expect(authPayload.authTier).toBe('alchemist')
      expect(authPayload.rateLimitRpm).toBe(300)

      // Conflicting credentials between HTTP Authorization header and _meta.apiKey
      const conflictRes = await postMcp(
        createJsonRpcPost(
          {
            jsonrpc: '2.0',
            id: 306,
            method: 'tools/call',
            params: {
              name: 'get_caller_allowance',
              arguments: {
                _meta: { apiKey: 'pa_live_different_key_1' },
              },
            },
          },
          { Authorization: 'Bearer pa_live_header_key_2' }
        )
      )
      const conflictJson = await conflictRes.json()
      expect(conflictJson.result.isError).toBe(true)
      expect(conflictJson.result.structuredContent.errorCode).toBe('AUTH_CONFLICT_OR_INVALID')
      expect(conflictJson.result.structuredContent.remediation).toBeTruthy()
    })

    it('enforces PR #98 culinary domain boundary with self-healing remediation pointing to alchm.kitchen', async () => {
      const culinaryRes = await postMcp(
        createJsonRpcPost({
          jsonrpc: '2.0',
          id: 307,
          method: 'tools/call',
          params: {
            name: 'generate_cosmic_recipe',
            arguments: { cuisine: 'Mediterranean' },
          },
        })
      )
      const culinaryJson = await culinaryRes.json()
      expect(culinaryJson.result.isError).toBe(true)
      expect(culinaryJson.result.structuredContent.errorCode).toBe('CULINARY_DOMAIN_BOUNDARY')
      expect(culinaryJson.result.structuredContent.upstreamMcpEndpoint).toBe(
        'https://alchm.kitchen/api/mcp'
      )
      expect(culinaryJson.result.structuredContent.remediation).toContain(
        'https://alchm.kitchen/api/mcp'
      )
    })
  })

  describe('4. Meta Muse Connector Discovery & Phase 1 OAuth Safety Guards', () => {
    it('serves /.well-known/muse/connector.json and neutralizes spoofed Host headers', async () => {
      const spoofedReq = new Request(
        'https://evil.attacker.example/.well-known/muse/connector.json',
        {
          method: 'GET',
          headers: {
            Host: 'evil.attacker.example',
            'X-Forwarded-Host': 'evil.attacker.example',
            Origin: 'https://platform.muse.ai',
          },
        }
      )
      const res = await getMuseConnector(spoofedReq)
      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://platform.muse.ai')
      const manifest = await res.json()
      expect(manifest.id).toBe('io.github.gregcastro23.planetary-agents')
      expect(manifest.mcp.endpoint).toBe('https://agents.alchm.kitchen/api/mcp')
      expect(manifest.sibling_connectors[0].endpoint).toBe('https://alchm.kitchen/api/mcp')
      expect(manifest.tools).toHaveLength(8)

      const badOptions = await optionsMuseConnector(
        new Request('https://agents.alchm.kitchen/.well-known/muse/connector.json', {
          method: 'OPTIONS',
          headers: { Origin: 'https://untrusted.example.org' },
        })
      )
      expect(badOptions.status).toBe(403)
    })

    it('gates /.well-known/oauth-protected-resource and /.well-known/oauth-authorization-server behind ENABLE_MCP_OAUTH', async () => {
      delete process.env.ENABLE_MCP_OAUTH

      const pr404 = await getOauthProtectedResource(
        new Request('https://agents.alchm.kitchen/.well-known/oauth-protected-resource')
      )
      expect(pr404.status).toBe(404)

      const as404 = await getOauthAuthServer(
        new Request('https://agents.alchm.kitchen/.well-known/oauth-authorization-server')
      )
      expect(as404.status).toBe(404)

      process.env.ENABLE_MCP_OAUTH = 'true'

      const pr200 = await getOauthProtectedResource(
        new Request('https://agents.alchm.kitchen/.well-known/oauth-protected-resource')
      )
      expect(pr200.status).toBe(200)
      const prJson = await pr200.json()
      expect(prJson.resource).toBe('https://agents.alchm.kitchen/api/mcp')

      const as200 = await getOauthAuthServer(
        new Request('https://agents.alchm.kitchen/.well-known/oauth-authorization-server')
      )
      expect(as200.status).toBe(200)
      const asJson = await as200.json()
      expect(asJson.issuer).toBe('https://agents.alchm.kitchen')
    })
  })
})
