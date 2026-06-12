'use client'

import React, { ReactNode } from 'react'
import TarotCosmicWidget from '@/components/misc/tarot-cosmic-widget'
import EnhancedTarotDashboard from '@/components/dashboards/enhanced-tarot-dashboard'

interface TarotEnhancedLayoutProps {
  children: ReactNode
  variant?: 'with-sidebar' | 'with-header' | 'with-dashboard' | 'minimal'
  showFullDashboard?: boolean
  title?: string
  description?: string
}

const TarotEnhancedLayout: React.FC<TarotEnhancedLayoutProps> = ({
  children,
  variant = 'minimal',
  showFullDashboard = false,
  title,
  description,
}) => {
  if (variant === 'with-sidebar') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {title && (
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">{title}</h1>
                {description && <p className="text-gray-600">{description}</p>}
              </div>
            )}
            {children}
          </div>

          {/* Sidebar with Tarot Widget */}
          <div className="lg:col-span-1 space-y-6">
            <TarotCosmicWidget variant="sidebar" showExpanded={false} linkToFullOracle={true} />

            {showFullDashboard && (
              <EnhancedTarotDashboard variant="compact" showAdvancedInsights={false} />
            )}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'with-header') {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Header with Tarot */}
        <div className="mb-8">
          {title && (
            <div className="mb-4">
              <h1 className="text-3xl font-bold mb-2">{title}</h1>
              {description && <p className="text-gray-600">{description}</p>}
            </div>
          )}

          <TarotCosmicWidget variant="header" linkToFullOracle={true} />
        </div>

        {/* Main Content */}
        {children}

        {showFullDashboard && (
          <div className="mt-12">
            <EnhancedTarotDashboard variant="compact" showAdvancedInsights={true} />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'with-dashboard') {
    return (
      <div className="container mx-auto px-4 py-8">
        {title && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            {description && <p className="text-gray-600 max-w-2xl mx-auto">{description}</p>}
          </div>
        )}

        {/* Full Tarot Dashboard */}
        <div className="mb-12">
          <EnhancedTarotDashboard variant="full" showAdvancedInsights={true} />
        </div>

        {/* Main Content */}
        {children}
      </div>
    )
  }

  // Minimal variant - just add a small widget
  return (
    <div className="container mx-auto px-4 py-8">
      {title && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {description && <p className="text-gray-600">{description}</p>}
        </div>
      )}

      {/* Main Content */}
      {children}

      {/* Small Tarot Widget at Bottom */}
      <div className="mt-12">
        <div className="max-w-md mx-auto">
          <TarotCosmicWidget variant="card" showExpanded={false} linkToFullOracle={true} />
        </div>
      </div>
    </div>
  )
}

export default TarotEnhancedLayout
