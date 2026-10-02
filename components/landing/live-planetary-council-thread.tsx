'use client'

import React from 'react'

import type { PlanetaryPosition } from '@/hooks/usePlanetaryPositions'
import { DailyPlanetaryCouncil } from './daily-planetary-council'

interface LivePlanetaryCouncilThreadProps {
  positions: PlanetaryPosition[]
  loading?: boolean
  lastUpdated?: Date | null
  onOpenCouncil: () => void
  onRefresh?: () => void
}

/** The compact homepage card reads the same edition as the full conversation. */
export function LivePlanetaryCouncilThread({ onOpenCouncil }: LivePlanetaryCouncilThreadProps) {
  return <DailyPlanetaryCouncil compact onOpenCouncil={onOpenCouncil} />
}
