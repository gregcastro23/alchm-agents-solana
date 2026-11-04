import { describe, expect, it } from 'vitest'
import { ZONE_PROFILES } from '@/lib/agents/rating'
import {
  WAR_TABLE_CANONICAL_ROSTER,
  autoSlotSquadOptimalEcr,
  buildPreviewMeleeHand,
  formatTarotMeleeCard,
  simulateAllZonesForSquad,
} from '@/lib/war/squad-optimizer'

describe('Wave 20A — 11-Zone War Table Squad Builder & Melee Simulator', () => {
  it('builds canonical War Table vessels with valid PVR (25–99) and differentiated bestZoneId across Houses, Spires, and Crown', () => {
    expect(WAR_TABLE_CANONICAL_ROSTER.length).toBeGreaterThanOrEqual(5)

    const bestZones = new Set<number>()
    for (const vessel of WAR_TABLE_CANONICAL_ROSTER) {
      expect(vessel.ovr).toBeGreaterThanOrEqual(25)
      expect(vessel.ovr).toBeLessThanOrEqual(99)
      expect(vessel.zoneSynergies).toHaveLength(11)
      expect(vessel.bestZoneId).toBeGreaterThanOrEqual(0)
      expect(vessel.bestZoneId).toBeLessThanOrEqual(10)
      bestZones.add(vessel.bestZoneId)
    }

    // Roster spans multiple distinct optimal zones (Houses, Spires, Crown)
    expect(bestZones.size).toBeGreaterThanOrEqual(4)
  })

  it('autoSlotSquadOptimalEcr assigns 5 vessels to 5 distinct zones and matches exact brute-force maximum ECR', () => {
    const squad = WAR_TABLE_CANONICAL_ROSTER.slice(0, 5)
    const assignment = autoSlotSquadOptimalEcr(squad)

    const assignedZoneIds = Object.keys(assignment).map(Number)
    const assignedVesselIds = Object.values(assignment)

    expect(assignedZoneIds).toHaveLength(5)
    expect(new Set(assignedZoneIds).size).toBe(5)
    expect(new Set(assignedVesselIds).size).toBe(5)

    const solverSum = assignedZoneIds.reduce((sum, zoneId) => {
      const vessel = squad.find(v => v.id === assignment[zoneId])!
      return sum + vessel.zoneSynergies[zoneId].synergy
    }, 0)

    // Verify optimality against exhaustive 5-zone permutation check
    let bruteForceBest = 0
    const zCount = ZONE_PROFILES.length
    for (let z0 = 0; z0 < zCount; z0++) {
      for (let z1 = 0; z1 < zCount; z1++) {
        if (z1 === z0) continue
        for (let z2 = 0; z2 < zCount; z2++) {
          if (z2 === z0 || z2 === z1) continue
          for (let z3 = 0; z3 < zCount; z3++) {
            if (z3 === z0 || z3 === z1 || z3 === z2) continue
            for (let z4 = 0; z4 < zCount; z4++) {
              if (z4 === z0 || z4 === z1 || z4 === z2 || z4 === z3) continue
              const candidateSum =
                squad[0].zoneSynergies[z0].synergy +
                squad[1].zoneSynergies[z1].synergy +
                squad[2].zoneSynergies[z2].synergy +
                squad[3].zoneSynergies[z3].synergy +
                squad[4].zoneSynergies[z4].synergy
              if (candidateSum > bruteForceBest) bruteForceBest = candidateSum
            }
          }
        }
      }
    }

    expect(solverSum).toBeCloseTo(bruteForceBest, 2)
  })

  it('formats my_melee_hand Tarot cards and applies element-resonant ECR bonuses in simulateAllZonesForSquad', () => {
    const hand = buildPreviewMeleeHand(0, 'Wands')
    expect(hand).toHaveLength(5)

    const fireCard = formatTarotMeleeCard({
      handId: 'h-1',
      tableId: 't-1',
      seatId: 's-1',
      cardId: 'c-1',
      suit: 'Wands',
      rank: 19,
      isMajor: true,
      inverted: false,
      played: false,
      trumpSuit: 'Wands',
    })
    expect(fireCard.element).toBe('Fire')
    expect(fireCard.ecrBonus).toBeGreaterThan(0)

    const squad = WAR_TABLE_CANONICAL_ROSTER.slice(0, 5)
    const slottedByZone = autoSlotSquadOptimalEcr(squad)

    const simsWithoutCard = simulateAllZonesForSquad({
      slottedByZone,
      roster: WAR_TABLE_CANONICAL_ROSTER,
      selectedCard: null,
    })
    const simsWithCard = simulateAllZonesForSquad({
      slottedByZone,
      roster: WAR_TABLE_CANONICAL_ROSTER,
      selectedCard: fireCard,
    })

    expect(simsWithCard).toHaveLength(11)

    for (let z = 0; z < 11; z++) {
      const baseSim = simsWithoutCard[z]
      const boostedSim = simsWithCard[z]
      if (boostedSim.attacker) {
        expect(boostedSim.effectiveAttackerEcr).toBeGreaterThan(baseSim.effectiveAttackerEcr)
        expect(boostedSim.winProbabilityPct).toBeGreaterThanOrEqual(5)
        expect(boostedSim.winProbabilityPct).toBeLessThanOrEqual(98)
        expect(boostedSim.projectedTricksWon).toBeGreaterThanOrEqual(1)
        expect(boostedSim.projectedTricksWon).toBeLessThanOrEqual(12)
        expect(boostedSim.contest).not.toBeNull()
        expect(Math.abs(boostedSim.contest!.controlDelta)).toBeLessThanOrEqual(40)
      }
    }
  })
})
