'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Users, Home, Sparkles, BookOpen, Clock } from 'lucide-react'

export function SiteNavigation() {
  return (
    <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-cyan-50 dark:from-purple-950/30 dark:via-blue-950/30 dark:to-cyan-950/30 border-b mb-6">
      <div className="container py-4">
        <nav className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <Home className="w-4 h-4" />
              Home
            </Button>
          </Link>
          <Link href="/gallery">
            <Button variant="ghost" size="sm" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Gallery
            </Button>
          </Link>
          <Link href="/planetary-agents">
            <Button variant="ghost" size="sm" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Planetary Agents
            </Button>
          </Link>
          <Link href="https://alchm.kitchen/quantities">
            <Button variant="ghost" size="sm" className="gap-2">
              <Clock className="w-4 h-4" />
              Time Laboratory
            </Button>
          </Link>
          <Link href="/planetary-council">
            <Button variant="ghost" size="sm" className="gap-2">
              <Users className="w-4 h-4" />
              Planetary Council
            </Button>
          </Link>
        </nav>
      </div>
    </div>
  )
}
