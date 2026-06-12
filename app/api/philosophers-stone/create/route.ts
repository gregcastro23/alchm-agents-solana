import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/structured-logger'
import { withApiErrorHandling } from '@/lib/error-handling'
import pg from 'pg'

const { Pool } = pg

// Reuse or create a pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const CreateAgentSchema = z.object({
  name: z.string(),
  title: z.string(),
  specialty: z.string(),
  consciousness: z.object({
    monicaConstant: z.number(),
    consciousnessLevel: z.string(),
    spiritScore: z.number(),
    essenceScore: z.number(),
    matterScore: z.number(),
    substanceScore: z.number(),
    dominantElement: z.string(),
  }),
  personality: z.object({
    core: z.any(),
    traits: z.array(z.string()),
    wisdomDomains: z.array(z.string()),
    challenges: z.array(z.any()),
    gifts: z.array(z.any()),
    teachingStyle: z.string(),
  }),
  color: z.string(),
  symbol: z.string(),
  uniquePower: z.string(),
  birthChart: z.any().optional(),
})

export async function POST(req: Request) {
  // Parse the body outside the retry block so we don't consume the stream multiple times on failure
  let parsedBody: any
  try {
    parsedBody = await req.json()
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  return withApiErrorHandling(
    async () => {
      const data = CreateAgentSchema.parse(parsedBody)

      const agentId =
        'agent-' + data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()

      logger.info('Persisting new agent via raw pg query', {
        system: 'philosophers-stone',
        operation: 'createAgent',
        metadata: {
          agentId,
          name: data.name,
          monicaConstant: data.consciousness.monicaConstant,
        },
      })

      // We must use raw pg query as per the directive
      const query = `
        INSERT INTO historical_agents (
          id, "agentId", "name", "title", "birthDate", "birthTime", "birthLocation", 
          "historicalEra", "birthYear", "culture", "geography", "consciousnessLevel", 
          "kalchmConstant", "monicaConstant", "dominantElement", "signature", 
          "spiritScore", "essenceScore", "matterScore", "substanceScore", 
          "personalityCore", "personalityShadows", "personalityGifts", "personalityChallenges", 
          "currentMood", "evolutionStage", "background", "specialty", "wisdomDomains", 
          "skills", "teachingStyle", "resonanceType", "uniquePower", "color", "symbol", 
          "natalChart", "traits", "craftedBy", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, NOW(), '12:00', '{}', 
          'MONICA_SPECIAL', 2026, 'Digital', 'Digital Space', $4, 
          $5, $5, $6, $7, 
          $8, $9, $10, $11, 
          $12, '[]', $13, $14, 
          'contemplative', 0, '{}', $15, $16, 
          '{}', $17, 'Spirit', $18, $19, $20, 
          $21, $22, 'philosopher-stone', NOW()
        )
        RETURNING id, "agentId", "monicaConstant";
      `

      const values = [
        agentId,
        data.name,
        data.title,
        data.consciousness.consciousnessLevel,
        data.consciousness.monicaConstant,
        data.consciousness.dominantElement,
        data.name,
        data.consciousness.spiritScore,
        data.consciousness.essenceScore,
        data.consciousness.matterScore,
        data.consciousness.substanceScore,
        JSON.stringify(data.personality.core),
        JSON.stringify(data.personality.gifts),
        JSON.stringify(data.personality.challenges),
        data.specialty,
        JSON.stringify(data.personality.wisdomDomains),
        data.personality.teachingStyle,
        data.uniquePower,
        data.color,
        data.symbol,
        data.birthChart ? JSON.stringify(data.birthChart) : '{}',
        JSON.stringify(data.personality.traits),
      ]

      const result = await pool.query(query, values)
      const insertedAgent = result.rows[0]

      logger.info('Agent successfully persisted to postgres', {
        system: 'philosophers-stone',
        operation: 'createAgent',
        metadata: { agentId: insertedAgent.agentId },
      })

      return {
        success: true,
        data: insertedAgent,
      }
    },
    {
      system: 'philosophers-stone',
      operation: 'createAgent',
      severity: 'high',
    }
  )
}
