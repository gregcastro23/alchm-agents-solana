import { NextRequest, NextResponse } from 'next/server'
import { calculateAllPlanets, type EnhancedBirthInfo } from '@/lib/enhanced-astronomical-calculator'
import { createMomentPlanetaryAgents } from '@/lib/services/planetary-agent-activation'

export async function POST(request: NextRequest) {
  try {
    const { date, userId = 'demo-user' } = await request.json()

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const selectedDate = new Date(date)

    // Create birth info for the selected date
    const birthInfo: EnhancedBirthInfo = {
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      hour: selectedDate.getHours(),
      minute: selectedDate.getMinutes(),
      second: selectedDate.getSeconds(),
      latitude: 37.7749, // San Francisco (doesn't affect planetary positions)
      longitude: -122.4194,
      timezone: 'America/Los_Angeles',
    }

    // Calculate planetary positions
    console.log('Birth info:', birthInfo)
    const planetaryData = calculateAllPlanets(birthInfo)
    console.log('Planetary data julianDay:', planetaryData.julianDay)
    console.log('Planets available:', Object.keys(planetaryData.planets))
    console.log('Sun data:', planetaryData.planets.Sun)

    // Create planetary agents for all planets
    console.log('About to create moment planetary agents...')
    const activatedAgents = createMomentPlanetaryAgents(planetaryData, {
      currentDateTime: selectedDate,
    })
    console.log('Created agents:', activatedAgents.length)

    // Convert to format expected by the chat system
    const planetaryAgents = activatedAgents.map(agent => ({
      id: agent.agent.id,
      name: agent.agent.name,
      planetaryRuler: agent.agent.name.split(' ')[0], // Extract planet name from "Planet in Sign"
      element: agent.config.element as 'Fire' | 'Water' | 'Air' | 'Earth' | 'Spirit',
      consciousnessLevel: agent.consciousnessState.level,
      activationStrength: agent.activationStrength,
      dignity: (agent.config as any).dignity as string,
      description:
        (agent.agent as any).description ||
        `${agent.agent.name} planetary intelligence at ${selectedDate.toLocaleString()}`,
    }))

    // Create welcome message for the group chat
    const welcomeMessage = {
      id: `welcome-${Date.now()}`,
      agentId: 'cosmic-council',
      agentName: 'Cosmic Council',
      content: `Welcome to the Planetary Council for ${selectedDate.toLocaleDateString()} at ${selectedDate.toLocaleTimeString()}! The following planetary intelligences have gathered to provide guidance for this moment:

${planetaryAgents.map(agent => `• ${agent.name} (${agent.element} - ${agent.consciousnessLevel})`).join('\n')}

Each planet brings its unique wisdom and energy to this cosmic conversation. What questions do you have about this moment's celestial configuration?`,
      timestamp: new Date(),
      type: 'agent' as const,
    }

    return NextResponse.json({
      success: true,
      data: {
        agents: planetaryAgents,
        welcomeMessage,
        momentInfo: {
          date: selectedDate.toISOString(),
          location: 'San Francisco, CA',
          planetaryPositions: Object.entries(planetaryData.planets).map(([planet, data]) => ({
            planet,
            sign: data.sign,
            degree: data.signDegree,
            longitude: data.longitude,
          })),
        },
      },
    })
  } catch (error) {
    console.error('Error creating moment planetary group chat:', error)
    return NextResponse.json(
      {
        error: 'Failed to create planetary group chat',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
