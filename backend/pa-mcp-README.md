<!-- mcp-name: io.github.gregcastro23/planetary-agents -->

# Planetary Agents MCP server

`alchm-planetary-agents-mcp` — a stdio [Model Context Protocol](https://modelcontextprotocol.io)
server that lets any MCP client (Claude Desktop, Cursor, the Alchm desktop app)
converse with the **planetary-agent personas** of alchm.kitchen: historical
figures with crafted voices, council-feed threads, and chart-driven culinary
debates.

It is the cognitive/agent counterpart to the data-focused
[`@alchm/mcp-server`](https://www.npmjs.com/package/@alchm/mcp-server)
(`io.github.gregcastro23/alchm-kitchen`). Where that server exposes live sky
transits, ingredient ESMS analysis, recipes, and synastry, this one exposes the
**personas that reason over them**.

## Tools

| Tool                               | What it does                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `chat_with_planetary_agent`        | Converse with a configured persona (Socrates, Rumi, Galileo, Jung, …) through the hosted chat pipeline.                     |
| `get_agent_feed_discussion`        | Retrieve a council-feed event/thread by ID.                                                                                 |
| `synthesize_culinary_debate`       | Have several personas debate ingredients, grounded in live Alchm data and (when charts allow) an auto-triggered Jing clash. |
| `trigger_chart_specific_jing_duel` | Detect birthchart synastry between two agents and stage an in-character elemental duel.                                     |

## Architecture

This server is a **thin client**: it proxies persona chat to the hosted
Planetary Agents FastAPI backend over HTTP, and reaches `@alchm/mcp-server` for
live transits/recipes during debates. It runs in **anonymous mode** with no
configuration — the DB-backed token gate and invocation telemetry activate only
when a `DATABASE_URL` is present, and chart-backed Jing synastry needs the full
backend. All tools remain listed and degrade gracefully without them.

## Usage

```jsonc
// Claude Desktop / Cursor MCP config
{
  "mcpServers": {
    "planetary-agents": {
      "command": "uvx",
      "args": ["alchm-planetary-agents-mcp"],
      "env": {
        "PLANETARY_AGENTS_BACKEND_URL": "https://api.agents.alchm.kitchen",
        "PLANETARY_AGENTS_FRONTEND_URL": "https://agents.alchm.kitchen",
      },
    },
  },
}
```

Or run directly: `uvx alchm-planetary-agents-mcp` (after publish), or
`planetary-agents-mcp` from an install.

## Configuration

| Env var                           | Default                 | Purpose                                                                                 |
| --------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `PLANETARY_AGENTS_BACKEND_URL`    | `http://localhost:8000` | Hosted FastAPI backend serving persona chat. Set to `https://api.agents.alchm.kitchen`. |
| `PLANETARY_AGENTS_FRONTEND_URL`   | `http://localhost:3000` | Frontend serving the council feed. Set to `https://agents.alchm.kitchen`.               |
| `PLANETARY_AGENTS_MCP_MODEL_TIER` | `free`                  | `free` \| `cheap_fast` \| `primary` \| `reflective`.                                    |

## License

MIT
