# Galileo MCP Server Integration

This document describes the integration of Galileo MCP (Model Context Protocol) server with the Planetary Agents application.

## Overview

The Galileo MCP server provides AI-powered development assistance and observability tools through IDEs like Cursor and VS Code. Our integration includes:

1. **IDE Configuration** - MCP server setup for development tools
2. **Agent Logging** - Structured logging of all agent interactions
3. **Performance Monitoring** - Real-time tracking of API response times
4. **Synergy Analytics** - Moment synergy calculation tracking
5. **Consciousness Evolution** - Agent consciousness level changes

## IDE Setup

### Cursor Configuration

1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Select "Open MCP Settings"
3. Configuration is already set in `.cursor/mcp_settings.json`
4. Restart Cursor

### VS Code Configuration

1. Install GitHub Copilot extension
2. Open Command Palette
3. Search for "MCP: Open User Configuration"
4. Configuration is already set in `.vscode/mcp_config.json`
5. Reload VS Code

## Environment Variables

Add to your `.env.local`:

```bash
# Galileo API Configuration
GALILEO_API_KEY=your_api_key_here
GALILEO_PROJECT=AlchmPlanetaryAgents
GALILEO_LOG_STREAM=agent-interactions
```

Get your API key from: https://app.galileo.ai/settings/api-keys

## What Gets Logged

### Agent Interactions

Every chat interaction with historical agents logs:

- **User Input**: Original question/message
- **Agent Response**: Generated response text
- **Moment Synergy**: Current cosmic alignment score (0-100%)
- **Consciousness Data**: Agent level, Monica Constant, dominant element
- **Performance Metrics**: Response time, token count, model used
- **Session Data**: Unique session ID for conversation threading

### Structured Traces

Each interaction creates a trace with multiple spans:

1. **User Input Span** (type: retrieval)
   - Captures user message
   - Agent identification metadata

2. **Consciousness Analysis Span** (type: analysis)
   - Moment synergy calculation
   - Consciousness level evaluation

3. **Response Generation Span** (type: generation)
   - AI model invocation
   - Response generation timing
   - Token usage tracking

### Synergy Calculations

Tracks all moment synergy calculations:

- Synergy score (0-100%)
- Harmonic aspects count
- Challenging aspects count
- Calculation duration
- Agent birth chart data

### Performance Metrics

API-level performance tracking:

- Endpoint response times
- HTTP status codes
- Error messages
- Request metadata

## Usage Examples

### Querying Galileo MCP in Your IDE

With the MCP server configured, you can ask your AI assistant:

```
"Can you show me the latest agent interactions from Galileo?"
"What's the average synergy score for Leonardo da Vinci?"
"Show me slow API responses from the last hour"
"Create a prompt template for agent interactions"
```

### Programmatic Logging

```typescript
import { getGalileoAgentMCP } from '@/lib/galileo-agent-mcp-integration'

const galileoMCP = getGalileoAgentMCP()

// Log an agent interaction
await galileoMCP.logAgentInteraction({
  agentId: 'leonardo-da-vinci',
  agentName: 'Leonardo da Vinci',
  agentType: 'historical',
  userMessage: 'Tell me about your art',
  agentResponse: 'Art is a reflection...',
  sessionId: 'session-123',
  momentSynergy: {
    score: 85,
    description: 'Excellent cosmic alignment',
    harmonicCount: 3,
    challengingCount: 1,
  },
  consciousness: {
    level: 'Transcendent',
    monicaConstant: 6.42,
    dominantElement: 'Fire',
  },
  performance: {
    responseTime: 1250,
    tokenCount: 450,
    modelUsed: 'gpt-4',
  },
  timestamp: new Date(),
})

// Log synergy calculation
await galileoMCP.logSynergyCalculation({
  agentId: 'leonardo-da-vinci',
  natalChart: chart,
  currentMoment: new Date(),
  synergyScore: 85,
  harmonicAspects: [...],
  challengingAspects: [...],
  calculationTime: 45,
})

// Log council interactions
await galileoMCP.logCouncilInteraction({
  sessionId: 'council-123',
  agents: ['leonardo-da-vinci', 'carl-jung', 'marie-curie'],
  userQuestion: 'What is consciousness?',
  responses: {
    'leonardo-da-vinci': 'Consciousness is...',
    'carl-jung': 'From my perspective...',
    'marie-curie': 'Scientifically speaking...',
  },
  synergies: {
    'leonardo-da-vinci': 85,
    'carl-jung': 92,
    'marie-curie': 78,
  },
  totalResponseTime: 3500,
})
```

## Dashboard Insights

In your Galileo dashboard, you can visualize:

### Agent Performance

- Response time distribution by agent
- Synergy score trends over time
- Most active agents
- Consciousness level distribution

### User Engagement

- Message volume by hour/day
- Average conversation length
- Most discussed topics
- Session duration patterns

### Quality Metrics

- High synergy interactions (>80%)
- Low synergy interactions (<50%)
- Error rates and types
- Model performance comparison

### Cosmic Correlations

- Synergy scores vs. planetary positions
- Elemental influence on interactions
- Aspect patterns and their effects
- Optimal interaction times

## MCP Tools Available

The Galileo MCP server provides these tools:

### Dataset Management

- `create_dataset` - Create training datasets from logs
- `check_dataset_status` - Monitor dataset processing
- `export_dataset` - Download processed datasets

### Prompt Engineering

- `create_prompt_template` - Design reusable prompts
- `test_prompt` - Validate prompt effectiveness
- `optimize_prompt` - Improve prompt performance

### Experimentation

- `setup_experiment` - Configure A/B tests
- `track_experiment` - Monitor experiment metrics
- `analyze_results` - Compare experiment outcomes

### Log Analysis

- `get_log_insights` - AI-powered log analysis
- `search_logs` - Query historical data
- `aggregate_metrics` - Compute statistics

### Integration

- `generate_openai_code` - OpenAI integration snippets
- `generate_langchain_code` - LangChain integration
- `export_traces` - Download trace data

## Troubleshooting

### MCP Server Not Responding

1. Verify API key is set correctly
2. Check internet connectivity
3. Restart IDE
4. Try `Accept: text/event-stream` header

### Logs Not Appearing

1. Confirm `GALILEO_API_KEY` environment variable
2. Check console for error messages
3. Verify project name matches your Galileo project
4. Wait a few minutes for data to propagate

### Performance Issues

1. Logging is non-blocking and fails silently
2. Uses circuit breaker pattern for resilience
3. Falls back to console.log if Galileo unavailable
4. Batches are sent asynchronously

## Best Practices

### Logging Strategy

- ✅ Log all agent interactions
- ✅ Track synergy calculations
- ✅ Monitor performance metrics
- ✅ Use structured metadata
- ❌ Don't log sensitive user data
- ❌ Don't block on logging failures

### Metadata Enrichment

Add rich context to logs:

```typescript
metadata: {
  userId: anonymizedId,
  sessionType: 'chat',
  deviceType: 'mobile',
  browserInfo: userAgent,
  experimentVariant: 'A',
}
```

### Query Optimization

Use MCP tools to:

- Create indexes on frequently queried fields
- Set up automatic aggregations
- Configure real-time alerts
- Schedule periodic reports

## Integration Points

### Current Integrations

- ✅ `/api/monica-agent` - Historical agent chat
- ⏳ `/api/planetary-council` - Multi-agent council
- ⏳ `/api/unified-multi-agent-chat` - Unified chat system
- ⏳ `/api/moment-recommendations` - Recommendation engine

### Future Integrations

- Tarot system interactions
- Rune forge calculations
- Time laboratory sessions
- Philosopher's Stone crafting

## Security Considerations

### API Key Protection

- ✅ API key stored in environment variables
- ✅ Never committed to version control
- ✅ Different keys for dev/staging/prod
- ✅ Rotated regularly

### Data Privacy

- ✅ User IDs anonymized
- ✅ PII filtered from logs
- ✅ Retention policies configured
- ✅ GDPR compliance enabled

## Resources

- [Galileo MCP Documentation](https://v2docs.galileo.ai/getting-started/mcp/setup-galileo-mcp)
- [Galileo Dashboard](https://app.galileo.ai/)
- [API Keys Management](https://app.galileo.ai/settings/api-keys)
- [Galileo SDK Reference](https://docs.rungalileo.io/)

## Support

For issues or questions:

1. Check Galileo documentation
2. Review application logs
3. Contact Galileo support
4. File issue in project repository

---

**Last Updated**: October 23, 2025
**Integration Version**: 1.0.0
**Galileo SDK Version**: 1.9.0
