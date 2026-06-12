'use client'

import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonLoaderProps {
  type: 'dashboard' | 'chart' | 'agent-card' | 'list' | 'form'
  count?: number
  className?: string
}

export function SkeletonLoader({ type, count = 1, className = '' }: SkeletonLoaderProps) {
  const renderSkeleton = (index: number) => {
    switch (type) {
      case 'dashboard':
        return (
          <Card key={index} className={className}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            </CardContent>
          </Card>
        )

      case 'chart':
        return (
          <Card key={index} className={className}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-80 w-full rounded-lg" />
              <div className="flex justify-between mt-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-4 w-12" />
                ))}
              </div>
            </CardContent>
          </Card>
        )

      case 'agent-card':
        return (
          <Card key={index} className={className}>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-14" />
                </div>
              </div>
            </CardContent>
          </Card>
        )

      case 'list':
        return (
          <div key={index} className={`space-y-3 ${className}`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        )

      case 'form':
        return (
          <Card key={index} className={className}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-32 w-full" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        )

      default:
        return (
          <Card key={index} className={className}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </CardContent>
          </Card>
        )
    }
  }

  return <>{Array.from({ length: count }).map((_, index) => renderSkeleton(index))}</>
}

// Specialized skeleton components for common use cases
export function DashboardSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="dashboard" count={count} />
}

export function ChartSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="chart" count={count} />
}

export function AgentCardSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="agent-card" count={count} />
}

export function ListSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="list" count={count} />
}

export function FormSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader type="form" count={count} />
}

// Page-level skeleton loaders
export function PageSkeleton({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-8">
      {title && (
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      )}
      {children}
    </div>
  )
}
