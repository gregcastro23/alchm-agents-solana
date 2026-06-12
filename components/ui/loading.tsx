'use client'

import { Loader2, Sparkles, Brain, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'consciousness' | 'kinetic' | 'alchemical'
  className?: string
}

export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  const IconComponent = {
    default: Loader2,
    consciousness: Brain,
    kinetic: Zap,
    alchemical: Sparkles,
  }[variant]

  const variantClasses = {
    default: 'text-primary',
    consciousness: 'text-purple-500',
    kinetic: 'text-blue-500',
    alchemical: 'text-amber-500',
  }

  return (
    <IconComponent
      className={cn('animate-spin', sizeClasses[size], variantClasses[variant], className)}
    />
  )
}

interface LoadingStateProps {
  message?: string
  variant?: 'default' | 'consciousness' | 'kinetic' | 'alchemical'
  size?: 'sm' | 'md' | 'lg'
  showSpinner?: boolean
  className?: string
  children?: React.ReactNode
}

export function LoadingState({
  message,
  variant = 'default',
  size = 'md',
  showSpinner = true,
  className,
  children,
}: LoadingStateProps) {
  const messages = {
    default: 'Loading...',
    consciousness: 'Awakening consciousness...',
    kinetic: 'Calculating kinetic resonance...',
    alchemical: 'Transforming alchemical energies...',
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center space-y-4',
        className
      )}
    >
      {showSpinner && <LoadingSpinner size={size === 'sm' ? 'md' : 'lg'} variant={variant} />}

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{message || messages[variant]}</p>
        {children}
      </div>
    </div>
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  variant?: 'default' | 'consciousness' | 'kinetic' | 'alchemical'
  className?: string
  children: React.ReactNode
}

export function LoadingOverlay({
  isLoading,
  message,
  variant = 'default',
  className,
  children,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}

      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <LoadingState message={message} variant={variant} size="lg" />
        </div>
      )}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'avatar' | 'card' | 'button'
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full',
    avatar: 'h-12 w-12 rounded-full',
    card: 'h-32 w-full rounded-lg',
    button: 'h-10 w-24 rounded-md',
  }

  return (
    <div className={cn('animate-pulse bg-muted rounded', variantClasses[variant], className)} />
  )
}

export function AgentCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center space-x-3">
        <Skeleton variant="avatar" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="button" className="w-16" />
        <Skeleton variant="button" className="w-20" />
      </div>
    </div>
  )
}
