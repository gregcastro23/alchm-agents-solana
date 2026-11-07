#!/usr/bin/env node
/**
 * Planetary Agents MCP Server (`pa-mcp` v1.5.0) — Stdio / Tauri Sidecar Entrypoint.
 *
 * Strictly enforces stdio hygiene: stdout is reserved exclusively for JSON-RPC 2.0
 * protocol frames; all diagnostic logging is routed to stderr.
 */

const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-V')) {
  process.stdout.write('pa-mcp 1.5.0\n')
  process.exit(0)
}
if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(
    [
      'pa-mcp 1.5.0 — Planetary Agents Model Context Protocol Server (agents.alchm.kitchen)',
      '',
      'Usage: pa-mcp [options]',
      '  -V, --version   Output the version number',
      '  -h, --help      Display help for command',
      '',
      'Environment variables:',
      '  ALCHM_MCP_API_KEY         Default API key for authenticated tool calls',
      '  ALCHM_MCP_SESSION_TOKEN   Default session token when not using an API key',
      '',
    ].join('\n')
  )
  process.exit(0)
}

console.log = (...logArgs: unknown[]) => console.error(...logArgs)
console.info = (...logArgs: unknown[]) => console.error(...logArgs)
console.debug = (...logArgs: unknown[]) => console.error(...logArgs)

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

async function main() {
  const { createPlanetaryAgentsMcpServer } = await import('../lib/mcp/serverFactory')

  const server = createPlanetaryAgentsMcpServer({
    defaultApiKey: process.env.ALCHM_MCP_API_KEY,
    defaultSessionToken: process.env.ALCHM_MCP_SESSION_TOKEN,
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[pa-mcp v1.5.0] Planetary Agents MCP server listening on stdio')
}

main().catch(error => {
  console.error('[pa-mcp] Fatal startup error:', error)
  process.exit(1)
})
