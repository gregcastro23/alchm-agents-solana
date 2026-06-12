'use client'

import { lazy, Suspense } from 'react'
import { MonicaErrorBoundary } from './monica-error-boundary'

// Lazy load the Monica component to avoid initialization issues during app startup
const MonicaOmnipresent = lazy(() =>
  import('./monica-omnipresent')
    .then(module => ({
      default: module.MonicaOmnipresent,
    }))
    .catch(error => {
      console.warn('Failed to load Monica component:', error)
      // Return a component that renders nothing
      return { default: () => null }
    })
)

export function MonicaLazy() {
  return (
    <MonicaErrorBoundary>
      <Suspense fallback={null}>
        <MonicaOmnipresent />
      </Suspense>
    </MonicaErrorBoundary>
  )
}
