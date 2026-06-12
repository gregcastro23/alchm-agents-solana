import { NextResponse } from 'next/server'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    let alchmData: any[] = []
    let dietData: Record<string, any> = {}

    try {
      const filePath = path.join(
        process.cwd(),
        'scripts',
        'output',
        'agent-ingredient-recommendations.json'
      )
      if (fs.existsSync(filePath)) {
        alchmData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      }
    } catch (err) {
      console.warn('Failed to load alchm data', err)
    }

    try {
      const dietFiles = ['diet-data-part1.json', 'diet-data-part2.json', 'diet-data-part3.json']
      for (const file of dietFiles) {
        const p = path.join(process.cwd(), 'scripts', file)
        if (fs.existsSync(p)) {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
          dietData = { ...dietData, ...parsed }
        }
      }
    } catch (err) {
      console.warn('Failed to load diet data files', err)
    }

    // Map through the hardcoded registry to extract just the dietary and birth data
    // This provides a lightweight payload for the Alchm.kitchen backend to query
    const dietProfiles = DEMO_AGENTS.map(agent => {
      const agentAlchm = alchmData.find((a: any) => a.agentId === agent.id) || {}
      const historicalDiet = dietData[agent.id] || null

      return {
        agentId: agent.id,
        name: agent.name,
        title: agent.title,
        era: agent.era,
        birthData: agent.birthData,
        historicalDiet: historicalDiet || (agent as any).historicalDiet || null,
        alchemicalState: agentAlchm.alchemicalState || null,
        contextBlueprint: agentAlchm.contextBlueprint || null,
      }
    })

    return NextResponse.json({
      success: true,
      total: dietProfiles.length,
      profiles: dietProfiles,
    })
  } catch (error: any) {
    console.error('Failed to serve diet profiles:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
