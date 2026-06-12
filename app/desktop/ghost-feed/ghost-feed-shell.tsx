'use client'

import { useEffect } from 'react'
import { CouncilFeedClient } from '@/components/cosmic-agents/council-feed-client'
import type { ChartOfMoment, CouncilAgent, FeedEvent } from '@/components/cosmic-agents/types'

interface DesktopGhostFeedShellProps {
  initialChart: ChartOfMoment
  initialAgents: CouncilAgent[]
  initialUserAgent: CouncilAgent | null
  initialFeed?: FeedEvent[]
}

export function DesktopGhostFeedShell(props: DesktopGhostFeedShellProps) {
  useEffect(() => {
    document.documentElement.classList.add('desktop-ghost-feed-html')
    document.body.classList.add('desktop-ghost-feed-body')

    return () => {
      document.documentElement.classList.remove('desktop-ghost-feed-html')
      document.body.classList.remove('desktop-ghost-feed-body')
    }
  }, [])

  return (
    <div className="desktop-ghost-feed">
      <div className="ghost-drag-rail" data-tauri-drag-region aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <CouncilFeedClient {...props} desktopWidget />
    </div>
  )
}
