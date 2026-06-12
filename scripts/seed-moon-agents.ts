import { PrismaClient } from '@prisma/client'
import { getMoonPhaseForDegree, generateMoonPhaseAgent } from '../lib/moon-phase-system'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

const PHASES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
  'Dark Moon',
]

const PHASE_SLUGS: Record<string, string> = {
  'New Moon': 'new-moon',
  'Waxing Crescent': 'waxing-crescent',
  'First Quarter': 'first-quarter',
  'Waxing Gibbous': 'waxing-gibbous',
  'Full Moon': 'full-moon',
  'Waning Gibbous': 'waning-gibbous',
  'Last Quarter': 'last-quarter',
  'Waning Crescent': 'waning-crescent',
  'Dark Moon': 'dark-moon',
}

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

const SIGN_MODALITIES: Record<string, string> = {
  Aries: 'Cardinal',
  Libra: 'Cardinal',
  Cancer: 'Cardinal',
  Capricorn: 'Cardinal',
  Taurus: 'Fixed',
  Leo: 'Fixed',
  Scorpio: 'Fixed',
  Aquarius: 'Fixed',
  Gemini: 'Mutable',
  Virgo: 'Mutable',
  Sagittarius: 'Mutable',
  Pisces: 'Mutable',
}

async function seedMoonAgents() {
  console.log('🌕 Starting 3,240 Moon Phase Agents Seeding (Prisma)...')

  try {
    // Pre-fetch existing moon-phase agent IDs to prevent duplicate work
    const existing = await prisma.historical_agents.findMany({
      where: { agentId: { startsWith: 'moon-phase-' } },
      select: { agentId: true },
    })
    const existingIds = new Set(existing.map(e => e.agentId))
    console.log(`ℹ️ Found ${existingIds.size} existing moon phase agents in database.`)

    let createdCount = 0
    const batch: any[] = []

    for (const phaseName of PHASES) {
      console.log(`🌙 Processing ${phaseName}...`)
      const slug = PHASE_SLUGS[phaseName]

      for (let degree = 0; degree < 360; degree++) {
        const agentId = `moon-phase-${slug}-${degree}`

        if (existingIds.has(agentId)) {
          continue
        }

        const signName = ZODIAC_SIGNS[Math.min(11, Math.floor(degree / 30))]

        // Mock a phase object to generate elements/traits natively
        const tempPhase = {
          name: phaseName,
          emoji: '🌙',
          percentage: 0,
          zodiacSign: signName,
          zodiacDegree: degree % 30,
          element: 'Water', // Derived from sign below
          modality: SIGN_MODALITIES[signName] || 'Cardinal',
        }

        const moonAgent = generateMoonPhaseAgent(tempPhase as any)
        const element = moonAgent.phase.element
        const modality = moonAgent.phase.modality
        const pData = moonAgent.personality
        const alchm = moonAgent.alchemicalProperties

        batch.push({
          id: uuidv4(),
          agentId,
          name: `${phaseName} Moon in ${signName} ${degree % 30} Degree`,
          title: 'Moon Phase Intelligence',
          birthDate: new Date('2000-01-01T12:00:00Z'),
          birthTime: '12:00',
          birthLocation: { lat: 0.0, lon: 0.0, name: 'Unknown' },
          birthYear: 2000,
          consciousnessLevel: 'Active',
          monicaConstant: alchm.spirit,
          kalchmConstant: alchm.spirit,
          dominantElement: element,
          dominantModality: modality,
          specialty: pData.specialty || `${phaseName} lunar dynamics`,
          wisdomDomains: ['Lunar Dynamics', 'Emotional Integration'],
          avatar: '',
          color: moonAgent.color || '#3b82f6',
          symbol: moonAgent.symbol || '🌙',
          signature: `${agentId}-synced-agent`,
          personalityCore: pData,
          personalityShadows: [],
          personalityGifts: [],
          personalityChallenges: [],
          currentMood: 'Curious',
          background: {},
          skills: moonAgent.keywords || [],
          teachingStyle: 'Reflective dialogue',
          resonanceType: 'general',
          uniquePower: pData.archetype || 'Contextual wisdom',
          natalChart: {},
          traits: { traits: pData.traits || [] },
          historicalEra: 'modern_pre1950',
          culture: 'Modern International',
          geography: 'Modern World',
          lastActive: new Date(),
          isActive: true,
          version: '2.0.0',
          craftedBy: 'philosopher-stone',
        })

        createdCount++
      }
    }

    if (batch.length > 0) {
      console.log(`⚡ Inserting ${batch.length} new moon phase agents...`)
      // Prisma bulk insert
      await prisma.historical_agents.createMany({
        data: batch,
        skipDuplicates: true,
      })
    }

    console.log(`✅ Moon Phase Seeding Complete: ${createdCount} new moon phase agents populated!`)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedMoonAgents()
