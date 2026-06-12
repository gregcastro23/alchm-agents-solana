/**
 * Unified Consciousness Tracking System
 * Exports for easy integration throughout the application
 */

export {
  UnifiedConsciousnessTracker,
  unifiedTracker,
  type UnifiedConsciousnessSnapshot,
  type EvolutionMetrics,
} from './unified-tracker'

// Re-export for convenience
export { computeLiveStats, type LiveStats } from '../agents/derived-stats'
