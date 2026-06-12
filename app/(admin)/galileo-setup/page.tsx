'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, PlayCircle } from 'lucide-react'

type GalileoConfig = {
  configured: boolean
  quantitiesConfig: {
    hasApiKey: boolean
    project: string
    quantitiesStream: string
    loggerInitialized: boolean
  }
  agentConfig: {
    hasApiKey: boolean
    project: string
    logStream: string
    agentLoggerInitialized: boolean
  }
  failureStats: any
  recommendations: {
    nextSteps: string[]
  }
}

export default function GalileoSetupPage() {
  const [config, setConfig] = useState<GalileoConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/galileo-config')
      const data = await response.json()
      setConfig(data)
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const testGalileoLogging = async () => {
    try {
      setTesting(true)
      setTestResult(null)

      const response = await fetch('/api/galileo-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testData: {
            quantities: {
              Spirit: 42.5,
              Essence: 33.7,
              Matter: 18.9,
              Substance: 27.3,
              DayEssence: 15.2,
              NightEssence: 18.5,
            },
            dominantElement: 'Fire',
            heat: 0.85,
            entropy: 0.62,
            reactivity: 0.73,
            energy: 0.91,
            sunSign: 'Leo',
            chartRuler: 'Sun',
            timestamp: new Date().toISOString(),
          },
        }),
      })

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      console.error('Error testing Galileo:', error)
      setTestResult({
        success: false,
        error: 'Failed to test Galileo logging',
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Galileo Dashboard Setup</h1>
        <p className="text-muted-foreground">
          Configure and test your Galileo integration for quantities tracking in the dashboard.
        </p>
      </div>

      {/* Configuration Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Configuration Status
            {config?.configured ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
          </CardTitle>
          <CardDescription>Current status of your Galileo integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">API Key</span>
              <Badge variant={config?.quantitiesConfig?.hasApiKey ? 'default' : 'destructive'}>
                {config?.quantitiesConfig?.hasApiKey ? 'Set' : 'Missing'}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Project</span>
              <Badge variant="outline">{config?.quantitiesConfig?.project}</Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Stream</span>
              <Badge variant="outline">{config?.quantitiesConfig?.quantitiesStream}</Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">SDK</span>
              <Badge
                variant={config?.quantitiesConfig?.loggerInitialized ? 'default' : 'destructive'}
              >
                {config?.quantitiesConfig?.loggerInitialized ? 'Ready' : 'Not initialized'}
              </Badge>
            </div>
          </div>

          <Alert className={config?.configured ? 'border-green-200' : 'border-amber-200'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>
                {config?.configured
                  ? '✅ Galileo is configured and ready!'
                  : '⚠️  Galileo configuration needed'}
              </strong>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      {!config?.configured && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>
              Follow these steps to configure Galileo for quantities tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {config?.recommendations.nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Environment Variables:</strong> Add these to your <code>.env.local</code>{' '}
                file:
                <pre className="mt-2 p-2 bg-muted rounded text-sm">
                  {`GALILEO_API_KEY=your_api_key_here
GALILEO_PROJECT=AlchmPlanetaryAgents
GALILEO_QUANTITIES_STREAM=alchm-quantities`}
                </pre>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Test Integration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Integration</CardTitle>
          <CardDescription>Send a test quantities log to your Galileo dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={testGalileoLogging}
              disabled={testing || !config?.configured}
              className="w-full"
            >
              {testing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Send Test Data to Galileo
                </>
              )}
            </Button>

            {testResult && (
              <Alert className={testResult.success ? 'border-green-200' : 'border-red-200'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{testResult.success ? '✅ Success!' : '❌ Failed'}</strong>
                  <br />
                  {testResult.message}
                  {testResult.error && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        Error Details
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                        {testResult.details || testResult.error}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stream Information */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Configuration</CardTitle>
          <CardDescription>
            Information about your Galileo streams for quantities tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Official Galileo SDK Integration</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Uses the official Galileo SDK with proper traces and spans for comprehensive
                workflow visibility.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 border rounded-lg">
                  <strong>Sessions</strong>
                  <p className="text-muted-foreground">
                    Each calculation creates a session grouping related traces
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <strong>Traces</strong>
                  <p className="text-muted-foreground">
                    Complete alchemical calculation workflow from start to finish
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <strong>Spans</strong>
                  <p className="text-muted-foreground">
                    Individual steps: retriever, tool, and workflow spans
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium">Span Types in Your Workflow</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • <strong>Retriever:</strong> Getting planetary positions and astrological data
                </li>
                <li>
                  • <strong>Tool:</strong> Calculating base quantities (Spirit, Essence, Matter,
                  Substance)
                </li>
                <li>
                  • <strong>Tool:</strong> Computing alchemical metrics (heat, entropy, reactivity,
                  energy)
                </li>
                <li>
                  • <strong>Workflow:</strong> Complete calculation process with full context
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium">
                Stream: <code>{config?.quantitiesConfig?.quantitiesStream}</code>
              </h4>
              <p className="text-sm text-muted-foreground">
                All workflow data is organized in your project&apos;s log stream with complete
                traceability from input (planetary positions) to output (calculated quantities and
                metrics).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 mt-6">
        <Button onClick={fetchConfig} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>
    </div>
  )
}
