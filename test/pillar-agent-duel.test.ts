import { POST as handlePillarPost } from '@/app/api/agents/pillar/route'
import { NextRequest } from 'next/server'
import { describe, it, expect } from 'vitest'
import {
  AGENT_ARCHETYPE_CHARTS,
  DEFAULT_AGENT_POOLS,
  PILLAR_VOICE_LINES,
  answerPillarDuel,
  getAgentLegalHand,
  isPlanetaryAgent,
  openPillarDuel,
  type PlanetaryAgent,
} from '@/lib/pillar-agent-duel'
import {
  determineSkySect,
  getPillarHand,
  selectBestPillarResponse,
} from '@/lib/alchemical-kinetics'
import { PILLARS } from '@/lib/alchemy/pillars'

const ALL_PLANETS: PlanetaryAgent[] = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]

describe('Fourteen Pillars Agent Duel Engine', () => {
  it('guarantees all 10 agents have distinctive archetypal charts', () => {
    const signatures = new Set<string>()
    for (const p of ALL_PLANETS) {
      const sig = AGENT_ARCHETYPE_CHARTS[p].signs.join(',')
      signatures.add(sig)
    }
    // Each of the 10 planets must have a unique chart placement signature
    expect(signatures.size).toBe(10)
  })

  it('validates all ten planetary agents', () => {
    for (const p of ALL_PLANETS) {
      expect(isPlanetaryAgent(p)).toBe(true)
      expect(AGENT_ARCHETYPE_CHARTS[p]).toBeDefined()
      expect(AGENT_ARCHETYPE_CHARTS[p].signs.length).toBe(10)
      expect(AGENT_ARCHETYPE_CHARTS[p].timeKnown).toBe(true)
    }
    expect(isPlanetaryAgent('Earth')).toBe(false)
    expect(isPlanetaryAgent('Chiron')).toBe(false)
  })

  it('guarantees every agent holds at least 2 playable pillars in both skies', () => {
    for (const p of ALL_PLANETS) {
      const diurnalHand = getAgentLegalHand(p, 'diurnal')
      const nocturnalHand = getAgentLegalHand(p, 'nocturnal')

      expect(diurnalHand.length).toBeGreaterThanOrEqual(2)
      expect(nocturnalHand.length).toBeGreaterThanOrEqual(2)

      for (const pillar of diurnalHand) {
        expect(['diurnal', 'both']).toContain(pillar.sect)
      }
      for (const pillar of nocturnalHand) {
        expect(['nocturnal', 'both']).toContain(pillar.sect)
      }
    }
  })

  it('answers an opponent opening move with a legal counter and characterful voice', () => {
    const challengerChart = AGENT_ARCHETYPE_CHARTS['Mars']
    const challengerPools = DEFAULT_AGENT_POOLS

    for (const agent of ALL_PLANETS) {
      const openingPillarId = 7 // Calcination (Fire, diurnal)
      const answer = answerPillarDuel(
        agent,
        openingPillarId,
        challengerChart,
        challengerPools,
        'diurnal'
      )

      expect(answer.chosenPillar).toBeDefined()
      expect(answer.chosenPillar.id).toBeGreaterThanOrEqual(1)
      expect(answer.chosenPillar.id).toBeLessThanOrEqual(14)
      expect(['diurnal', 'both']).toContain(answer.chosenPillar.sect)

      // Voice line checks
      expect(answer.voice.length).toBeGreaterThan(10)
      expect(answer.voice).toContain(answer.chosenPillar.name)

      // Outcome checks
      expect(answer.outcome).toBeDefined()
      expect(typeof answer.outcome.ratioA).toBe('number')
      expect(typeof answer.outcome.ratioB).toBe('number')
    }
  })

  it('opens a duel with a ruling or legal pillar', () => {
    for (const agent of ALL_PLANETS) {
      const open = openPillarDuel(agent, undefined, 'diurnal')
      expect(open.openingPillar).toBeDefined()
      expect(['diurnal', 'both']).toContain(open.openingPillar.sect)
      expect(open.voice).toContain(open.openingPillar.name)
      expect(open.magnitude).toBeGreaterThanOrEqual(0.25)
      expect(open.magnitude).toBeLessThanOrEqual(2.0)
    }
  })

  it('correctly determines sky sect from solar hours and coordinates', () => {
    // Noon
    const noon = new Date('2026-09-15T12:00:00Z')
    expect(determineSkySect(noon, 0, 0)).toBe('diurnal')

    // Midnight
    const midnight = new Date('2026-09-15T00:00:00Z')
    expect(determineSkySect(midnight, 0, 0)).toBe('nocturnal')
  })

  it('serves the Pentacles feeder contract via /api/agents/pillar POST', async () => {
    const req = new NextRequest('http://localhost:3000/api/agents/pillar', {
      method: 'POST',
      body: JSON.stringify({
        planet: 'Sun',
        opening: 'Calcination',
        sky: 'diurnal',
        source: 'pentacles-pillar-feeder',
      }),
    })

    const res = await handlePillarPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.planet).toBe('Sun')
    expect(typeof json.pillar).toBe('string')
    expect(typeof json.voice).toBe('string')
    expect(json.source).toBe('best-response')
    expect(typeof json.willWin).toBe('boolean')
  })
})
