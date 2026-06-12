'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class MonicaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: any) {
    console.error('Monica component error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      // Silently fail - Monica is not critical for app functionality
      console.warn('Monica component failed to load, continuing without it')
      return null
    }

    return this.props.children
  }
}
