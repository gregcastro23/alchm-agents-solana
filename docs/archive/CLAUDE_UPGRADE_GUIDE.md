# Claude Subscription Upgrade Guide

## Overview

Your Claude subscription has been upgraded! This guide covers the new capabilities, model options, and how to optimize your Planetary Agents application for the enhanced features.

## What's New

### Available Models

#### Claude 3.5 Series (Latest)

- **Claude 3.5 Sonnet** (`claude-3-5-sonnet-20241022`)
  - 200K context window
  - Best for complex reasoning and analysis
  - Ideal for astrological calculations and chart interpretation
- **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`)
  - 200K context window
  - Fast and efficient
  - Perfect for quick responses and simple tasks

#### Claude 3 Series

- **Claude 3 Opus** (`claude-3-opus-20240229`)
  - Most capable model
  - Best for advanced reasoning and creative tasks
- **Claude 3 Sonnet** (`claude-3-sonnet-20240229`)
  - Balanced performance
  - Good for general use cases
- **Claude 3 Haiku** (`claude-3-haiku-20240307`)
  - Lightweight and fast
  - Cost-effective for simple queries

### Enhanced Capabilities

1. **Longer Context Windows**
   - Up to 200K tokens (vs previous 100K)
   - Better for complex astrological calculations
   - Can process entire birth charts in one request

2. **Improved Reasoning**
   - Better logical analysis
   - Enhanced problem-solving capabilities
   - More accurate astrological interpretations

3. **Higher Rate Limits**
   - More requests per minute
   - Better reliability during peak usage
   - Priority access during high-traffic periods

4. **Advanced Features**
   - Tool use and function calling
   - Enhanced creativity
   - Better code generation

## Migration Steps

### 1. Update Environment Variables

Add these to your `.env.local`:

```bash
# Claude model preferences
CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
CLAUDE_FAST_MODEL=claude-3-5-haiku-20241022
```

### 2. Install Updated Dependencies

```bash
yarn add @anthropic-ai/sdk@^0.50.4
```

### 3. Update Your Code

The `lib/anthropic-client.ts` file has been updated with:

- New model constants
- Environment-based model selection
- Enhanced helper functions
- Model information utilities

### 4. Test the New Models

```bash
# Test default model (Claude 3.5 Sonnet)
curl -X POST http://localhost:3000/api/planetary-agent \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message", "modelType": "default"}'

# Test fast model (Claude 3.5 Haiku)
curl -X POST http://localhost:3000/api/planetary-agent \
  -H "Content-Type: application/json" \
  -d '{"message": "Quick test", "modelType": "fast"}'
```

## Best Practices

### Model Selection

```typescript
import { getClaudeModel, createClaudeMessage } from '@/lib/anthropic-client'

// For complex astrological calculations
const complexResponse = await createClaudeMessage(
  messages,
  systemPrompt,
  'default', // Uses Claude 3.5 Sonnet
  8192
)

// For quick responses
const quickResponse = await createClaudeMessage(
  messages,
  systemPrompt,
  'fast', // Uses Claude 3.5 Haiku
  2048
)

// For most demanding tasks
const powerfulResponse = await createClaudeMessage(
  messages,
  systemPrompt,
  'powerful', // Uses Claude 3 Opus
  16384
)
```

### Context Window Optimization

With 200K tokens, you can now:

1. **Process entire birth charts** in a single request
2. **Include comprehensive planetary rules** without truncation
3. **Maintain conversation history** for longer sessions
4. **Combine multiple data sources** in one analysis

### Rate Limit Management

```typescript
// Implement exponential backoff for rate limits
async function createMessageWithRetry(messages: any[], maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await createClaudeMessage(messages)
    } catch (error: any) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

## Performance Optimization

### 1. Model-Specific Prompts

```typescript
// Optimize prompts for Claude 3.5's capabilities
const enhancedSystemPrompt = `
You are an expert astrological AI with access to:
- 200K token context window for comprehensive analysis
- Advanced reasoning capabilities for complex calculations
- Enhanced creativity for personalized interpretations

Use these capabilities to provide:
- Detailed planetary analysis
- Comprehensive chart interpretations
- Personalized guidance based on full context
`
```

### 2. Batch Processing

```typescript
// Process multiple requests efficiently
async function batchProcessCharts(charts: any[]) {
  const batchSize = 5 // Adjust based on rate limits
  const results = []

  for (let i = 0; i < charts.length; i += batchSize) {
    const batch = charts.slice(i, i + batchSize)
    const batchPromises = batch.map(chart =>
      createClaudeMessage([{ role: 'user', content: chart }], undefined, 'fast')
    )

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Rate limit consideration
    if (i + batchSize < charts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
```

## Monitoring and Usage

### Track Usage

```typescript
import { getModelInfo } from '@/lib/anthropic-client'

// Get information about current model
const modelInfo = getModelInfo('default')
console.log(`Using ${modelInfo.name} for ${modelInfo.bestFor}`)
```

### Monitor Costs

- Check Anthropic dashboard regularly
- Monitor token usage per request
- Track rate limit usage
- Optimize model selection based on usage patterns

## Troubleshooting

### Common Issues

1. **Rate Limit Exceeded**
   - Implement exponential backoff
   - Use faster models for simple queries
   - Monitor usage patterns

2. **Model Not Available**
   - Check model names are correct
   - Verify API key has access to new models
   - Fall back to legacy models if needed

3. **Context Window Issues**
   - Monitor token usage
   - Implement chunking for very long content
   - Use appropriate model for content length

### Support Resources

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Claude Model Comparison](https://www.anthropic.com/models)
- [Rate Limit Guidelines](https://docs.anthropic.com/en/api/rate-limits)

## Next Steps

1. **Test all new models** with your existing functionality
2. **Optimize prompts** for Claude 3.5 capabilities
3. **Implement monitoring** for usage and performance
4. **Update documentation** for your team
5. **Plan for advanced features** like tool use and function calling

## Migration Checklist

- [ ] Updated environment variables
- [ ] Installed latest Anthropic SDK
- [ ] Updated anthropic-client.ts
- [ ] Tested new models
- [ ] Optimized prompts for 200K context
- [ ] Implemented rate limit handling
- [ ] Updated documentation
- [ ] Monitored initial usage
- [ ] Trained team on new capabilities

Your upgraded Claude subscription opens up new possibilities for more sophisticated astrological analysis and better user experiences. Take advantage of the enhanced capabilities to provide even more accurate and insightful planetary guidance!
