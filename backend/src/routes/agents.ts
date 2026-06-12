import { Router as createRouter, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { asyncHandler } from '../middleware/error-handler.js'

const router = createRouter()

/**
 * GET /api/agents/diet-profiles
 * Returns enriched historical agent data for the Alchm.kitchen sync script
 */
router.get(
  '/diet-profiles',
  asyncHandler(async (req: Request, res: Response) => {
    // Navigate to the project root directory where 'scripts' is located
    const rootDir = path.resolve(process.cwd(), '..')

    // 1. Read agent-ingredient-recommendations.json
    let recommendations: any[] = []
    try {
      const recommendationsPath = path.join(
        rootDir,
        'scripts',
        'output',
        'agent-ingredient-recommendations.json'
      )
      if (fs.existsSync(recommendationsPath)) {
        const fileData = fs.readFileSync(recommendationsPath, 'utf8')
        recommendations = JSON.parse(fileData)
      } else {
        console.warn(`Could not find recommendations at ${recommendationsPath}`)
      }
    } catch (err) {
      console.error('Error reading recommendations:', err)
    }

    // 2. Read diet-data-part*.json
    let dietData: Record<string, any> = {}
    try {
      const dietFiles = ['diet-data-part1.json', 'diet-data-part2.json', 'diet-data-part3.json']
      for (const file of dietFiles) {
        const p = path.join(rootDir, 'scripts', file)
        if (fs.existsSync(p)) {
          const fileData = fs.readFileSync(p, 'utf8')
          const parsed = JSON.parse(fileData)
          dietData = { ...dietData, ...parsed }
        }
      }
    } catch (err) {
      console.error('Error reading diet data:', err)
    }

    // 3. Assemble the payload
    // We iterate over the recommendations since it contains the valid agent base records
    const profiles = recommendations.map(rec => {
      const agentId = rec.agentId
      const historicalDiet = dietData[agentId] || null

      return {
        agentId: rec.agentId,
        name: rec.name,
        // Since we can't easily import HISTORICAL_AGENTS, we provide sensible defaults if missing
        title: rec.title || 'Historical Figure',
        era: rec.era || 'Unknown',
        historicalDiet,
        alchemicalState: rec.alchemicalState || null,
        contextBlueprint: rec.contextBlueprint || null,
        birthData: rec.birthData || null,
      }
    })

    res.json({
      success: true,
      profiles,
    })
  })
)

export default router
