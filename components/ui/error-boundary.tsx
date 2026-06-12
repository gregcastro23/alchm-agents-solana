'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    // Log error to console and optional callback
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  override render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props

      if (Fallback && this.state.error) {
        return <Fallback error={this.state.error} retry={this.retry} />
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          retry={this.retry}
        />
      )
    }

    return this.props.children
  }
}

interface DefaultErrorFallbackProps {
  error?: Error
  errorInfo?: React.ErrorInfo
  retry: () => void
}

function DefaultErrorFallback({ error, errorInfo, retry }: DefaultErrorFallbackProps) {
  const isProductionError = process.env.NODE_ENV === 'production'

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-destructive">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-destructive">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground text-sm">
            An unexpected error occurred while rendering this component.
          </p>

          {!isProductionError && error && (
            <div className="space-y-3">
              <Badge variant="destructive" className="text-xs">
                Development Mode
              </Badge>
              <div className="bg-muted p-3 rounded-md text-xs font-mono">
                <div className="font-semibold text-destructive mb-1">Error:</div>
                <div className="whitespace-pre-wrap">{error.message}</div>
                {error.stack && (
                  <>
                    <div className="font-semibold text-destructive mt-2 mb-1">Stack:</div>
                    <div className="whitespace-pre-wrap text-xs opacity-70">
                      {error.stack.slice(0, 500)}
                      {error.stack.length > 500 && '...'}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button onClick={retry} className="flex-1 flex items-center gap-2" variant="default">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
              className="flex-1 flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Button>
          </div>

          {!isProductionError && (
            <Button
              onClick={() => {
                console.log('Full Error Object:', error)
                console.log('Error Info:', errorInfo)
              }}
              variant="ghost"
              size="sm"
              className="w-full flex items-center gap-2 text-xs"
            >
              <Bug className="w-3 h-3" />
              Log Full Error
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// HOC for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Custom error fallbacks for specific scenarios
export function ConsciousnessErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-purple-200 bg-purple-50/50">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="p-3 bg-purple-100 rounded-full mx-auto w-fit">
            <AlertTriangle className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-800 mb-2">Consciousness Processing Error</h3>
            <p className="text-sm text-purple-600">
              Unable to process consciousness data. The agents are temporarily unavailable.
            </p>
          </div>
          <Button onClick={retry} variant="outline" className="border-purple-200">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function KineticErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="p-3 bg-blue-100 rounded-full mx-auto w-fit">
            <AlertTriangle className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 mb-2">Kinetic Analysis Error</h3>
            <p className="text-sm text-blue-600">
              Kinetic calculations temporarily unavailable. Real-time data processing paused.
            </p>
          </div>
          <Button onClick={retry} variant="outline" className="border-blue-200">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalculate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
