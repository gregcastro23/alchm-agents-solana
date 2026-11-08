import { describe, expect, it } from 'vitest'
import { GET as getOpenApi, OPTIONS as optionsOpenApi } from '@/app/api/mcp/openapi.json/route'
import { POST as postRestTool, OPTIONS as optionsRestTool } from '@/app/api/mcp/rest/[tool]/route'
import { isTrustedOrigin } from '@/lib/mcp/httpSecurity'
import mcpServerManifest from '@/mcp/server.json'

describe('Planetary Agents OpenAPI 3.1.0 REST Bridge, Expanded CORS & Registry Manifest', () => {
  it('allows Google AI Studio, Claude, ChatGPT, MCP Inspector, Smithery, and Glama browser origins', () => {
    expect(isTrustedOrigin('https://aistudio.google.com')).toBe(true)
    expect(isTrustedOrigin('https://idx.google.com')).toBe(true)
    expect(isTrustedOrigin('https://claude.ai')).toBe(true)
    expect(isTrustedOrigin('https://chatgpt.com')).toBe(true)
    expect(isTrustedOrigin('https://platform.openai.com')).toBe(true)
    expect(isTrustedOrigin('https://inspector.modelcontextprotocol.io')).toBe(true)
    expect(isTrustedOrigin('https://smithery.ai')).toBe(true)
    expect(isTrustedOrigin('https://glama.ai')).toBe(true)
    expect(isTrustedOrigin('https://evil-google.com')).toBe(false)
  })

  it('serves a valid OpenAPI 3.1.0 spec at GET /api/mcp/openapi.json with dual-mode auth', async () => {
    const req = new Request('https://agents.alchm.kitchen/api/mcp/openapi.json', {
      method: 'GET',
      headers: {
        Host: 'agents.alchm.kitchen',
        Origin: 'https://aistudio.google.com',
      },
    })
    const res = await getOpenApi(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://aistudio.google.com')

    const spec = await res.json()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.servers[0].url).toBe('https://agents.alchm.kitchen')
    expect(Object.keys(spec.paths)).toHaveLength(8)

    // 0-ESMS readOnlyHint: true tools have optional security
    const mentorOp = spec.paths['/api/mcp/rest/match_historical_mentor'].post
    expect(mentorOp.operationId).toBe('match_historical_mentor')
    expect(mentorOp['x-esms-cost']).toBe(0)
    expect(mentorOp['x-read-only']).toBe(true)
    expect(mentorOp.security).toEqual([{}, { BearerAuth: [] }])

    // Metered tools require BearerAuth
    const councilOp = spec.paths['/api/mcp/rest/convene_agent_council'].post
    expect(councilOp['x-esms-cost']).toBe(6)
    expect(councilOp['x-read-only']).toBe(false)
    expect(councilOp.security).toEqual([{ BearerAuth: [] }])

    const badOptions = await optionsOpenApi(
      new Request('https://agents.alchm.kitchen/api/mcp/openapi.json', {
        method: 'OPTIONS',
        headers: { Origin: 'https://untrusted.example.com' },
      })
    )
    expect(badOptions.status).toBe(403)
  })

  it('executes POST /api/mcp/rest/[tool] and returns unwrapped REST JSON', async () => {
    const okRes = await postRestTool(
      new Request('https://agents.alchm.kitchen/api/mcp/rest/match_historical_mentor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://chatgpt.com',
        },
        body: JSON.stringify({
          query: 'harmonic geometry',
          element: 'Earth',
          limit: 2,
        }),
      }),
      { params: Promise.resolve({ tool: 'match_historical_mentor' }) }
    )
    expect(okRes.status).toBe(200)
    expect(okRes.headers.get('access-control-allow-origin')).toBe('https://chatgpt.com')
    const okBody = await okRes.json()
    expect(okBody.ok).toBe(true)
    expect(okBody.mentors).toHaveLength(2)

    // Delegated culinary tool returns 400 with CULINARY_DOMAIN_BOUNDARY
    const culinaryRes = await postRestTool(
      new Request('https://agents.alchm.kitchen/api/mcp/rest/generate_cosmic_recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuisine: 'Italian' }),
      }),
      { params: Promise.resolve({ tool: 'generate_cosmic_recipe' }) }
    )
    expect(culinaryRes.status).toBe(400)
    const culinaryBody = await culinaryRes.json()
    expect(culinaryBody.errorCode).toBe('CULINARY_DOMAIN_BOUNDARY')
    expect(culinaryBody.remediation).toContain('https://alchm.kitchen/api/mcp')

    // Unknown tool returns 404
    const notFoundRes = await postRestTool(
      new Request('https://agents.alchm.kitchen/api/mcp/rest/unknown_tool_xyz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      { params: Promise.resolve({ tool: 'unknown_tool_xyz' }) }
    )
    expect(notFoundRes.status).toBe(404)

    const okOptions = await optionsRestTool(
      new Request('https://agents.alchm.kitchen/api/mcp/rest/match_historical_mentor', {
        method: 'OPTIONS',
        headers: { Origin: 'https://claude.ai' },
      })
    )
    expect(okOptions.status).toBe(204)
  })

  it('validates Official MCP Registry manifest at mcp/server.json', () => {
    expect(mcpServerManifest.name).toBe('io.github.gregcastro23/planetary-agents-mcp')
    expect(mcpServerManifest.version).toBe('1.5.0')
    expect(mcpServerManifest.remotes[0].url).toBe('https://agents.alchm.kitchen/api/mcp')
    expect(mcpServerManifest.openapi.url).toBe('https://agents.alchm.kitchen/api/mcp/openapi.json')
  })
})
