# Galileo Dashboard Setup for Quantities Tracking

This guide will help you set up structured quantities tracking in your Galileo dashboard for the Alchm Planetary Agents project using the official Galileo SDK with proper traces and spans.

## Prerequisites

1. A Galileo account and API key
2. Access to a Galileo project (we'll use "AlchmPlanetaryAgents")

## Setup Steps

### 1. Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Required: Your Galileo API key
GALILEO_API_KEY=your_api_key_here

# Optional: Project name (defaults to "AlchmPlanetaryAgents")
GALILEO_PROJECT=AlchmPlanetaryAgents

# Optional: Main quantities stream name (defaults to "alchm-quantities")
GALILEO_QUANTITIES_STREAM=alchm-quantities
```

### 2. Restart Your Application

After setting the environment variables, restart your development server:

```bash
yarn dev
```

### 3. Test the Integration

1. Navigate to `/galileo-setup` in your application
2. Check the configuration status
3. Click "Send Test Data to Galileo" to verify the integration works
4. Check your Galileo dashboard for the test data

## What Gets Tracked

### Official Galileo SDK Integration

The system uses the official Galileo SDK (`galileo` yarn package) with proper hierarchical logging:

#### Traces

Each alchemical calculation creates a trace that represents the complete workflow from planetary input to calculated quantities output using `logger.startTrace()` and `logger.conclude()`.

#### Spans

Each trace contains multiple spans representing discrete operations:

1. **Retriever Span:** `get-planetary-positions`
   - Created with `logger.addSpan({ spanType: 'retriever' })`
   - Fetches current planetary positions and astrological data
   - Input: Request for planetary positions with timestamp
   - Output: Planetary positions, sun sign, chart ruler

2. **Tool Span:** `calculate-base-quantities`
   - Created with `logger.addSpan({ spanType: 'tool' })`
   - Calculates Spirit, Essence, Matter, Substance from planetary data
   - Input: Planetary data and calculation method
   - Output: Base quantities and dominant element
   - Metadata: Individual quantity values as strings

3. **Tool Span:** `calculate-alchemical-metrics`
   - Created with `logger.addSpan({ spanType: 'tool' })`
   - Computes heat, entropy, reactivity, energy metrics
   - Input: Base quantities and dominant element
   - Output: Alchemical metrics
   - Metadata: Individual metric values as strings

### Data Stream: `alchm-quantities`

Each workflow logs the following data to your Galileo dashboard:

#### Quantities

- **Spirit**: Cosmic creative force
- **Essence**: Life-giving principle
- **Matter**: Physical substance
- **Substance**: Etheric foundation
- **Day Essence**: Diurnal elemental energy
- **Night Essence**: Nocturnal elemental energy

#### Alchemical Metrics

- **Heat**: Intensity of alchemical processes
- **Entropy**: Degree of systemic disorder
- **Reactivity**: Potential for change
- **Energy**: Overall system vitality

#### Astrological Context

- **Sun Sign**: Current zodiac sign of the Sun
- **Chart Ruler**: Ruling planet of the ascendant
- **Planetary Positions**: Complete ephemeris data
- **Dominant Element**: Primary elemental influence

#### Application Metadata

- Timestamp of calculation
- API endpoint used
- Calculation method
- Component source

## Dashboard Visualization

Once configured, you can create dashboards in Galileo to visualize:

### Trace-Level Analysis

1. **Workflow Traces**: See complete calculation workflows from input to output
2. **Trace Duration**: Monitor how long complete calculations take via `durationNs`
3. **Trace Success Rates**: Track successful vs failed calculation attempts
4. **Input/Output Analysis**: Review complete request/response data

### Span-Level Analysis

1. **Span Performance**: Individual operation timings for each retriever/tool span
2. **Span Types**: Visualize workflow steps by span type (retriever, tool)
3. **Span Outputs**: Detailed view of each calculation step's results
4. **Metadata Analysis**: Query individual quantity and metric values
5. **Error Analysis**: Identify which spans fail and why

### Metrics Visualization

1. **Real-time Quantities**: Current values of Spirit, Essence, Matter, Substance
2. **Alchemical Metrics**: Heat, entropy, reactivity, energy over time
3. **Astrological Correlations**: How planetary positions influence quantities
4. **Elemental Analysis**: Distribution of dominant elements and their effects

## Troubleshooting

### Common Issues

1. **"Galileo client not initialized"**
   - Check that `GALILEO_API_KEY` is set correctly
   - Restart your application after setting environment variables

2. **Data not appearing in dashboard**
   - Verify your API key has write permissions
   - Check the stream names match what you expect
   - Look at the console logs for error messages

3. **Test logging fails**
   - Ensure your Galileo project exists and is accessible
   - Check network connectivity
   - Verify API key format (should be a valid token)

### Validation Steps

Use the `/galileo-setup` page to:

1. Check configuration status
2. Send test data
3. Verify streams are working
4. Get detailed error information

## Stream Structure

### Workflow Log Entry Format

```json
{
  "project_name": "AlchmPlanetaryAgents",
  "workflows": [
    {
      "created_at_ns": 1753175650085000000,
      "duration_ns": 150000000,
      "input": "{\"session_id\":\"session_123\",\"session_name\":\"alchemical-quantities-calculation\",\"trace_name\":\"calculate-alchemical-quantities\",\"spans_count\":3}",
      "output": "{\"spans\":[{\"name\":\"get-planetary-positions\",\"type\":\"retriever\",\"status\":\"success\",\"duration_ms\":25},{\"name\":\"calculate-base-quantities\",\"type\":\"tool\",\"status\":\"success\",\"duration_ms\":75},{\"name\":\"calculate-alchemical-metrics\",\"type\":\"tool\",\"status\":\"success\",\"duration_ms\":50}],\"trace_metadata\":{\"dominant_element\":\"Fire\",\"api_endpoint\":\"/api/alchm-quantities\"},\"session_metadata\":{\"timestamp\":\"2025-07-22T10:00:00.000Z\",\"sun_sign\":\"Leo\",\"chart_ruler\":\"Sun\"}}",
      "name": "calculate-alchemical-quantities",
      "type": "workflow",
      "metadata": {
        "session_id": "session_123",
        "session_name": "alchemical-quantities-calculation",
        "trace_id": "trace_456",
        "spans_count": "3",
        "duration_ms": "150",
        "span_0_name": "get-planetary-positions",
        "span_0_type": "retriever",
        "span_0_status": "success",
        "span_1_name": "calculate-base-quantities",
        "span_1_type": "tool",
        "span_1_status": "success",
        "span_2_name": "calculate-alchemical-metrics",
        "span_2_type": "tool",
        "span_2_status": "success"
      }
    }
  ]
}
```

## Next Steps

1. Set up your environment variables
2. Visit `/galileo-setup` to configure and test
3. Monitor your Galileo dashboard for incoming workflow data
4. Create custom dashboards to visualize sessions, traces, and spans
5. Set up alerts for failed spans or unusual calculation patterns
6. Use span metadata to analyze alchemical patterns and correlations

Your alchemical calculations now use Galileo's structured logging architecture, providing comprehensive workflow visibility and detailed performance insights for analysis in your dashboard.
