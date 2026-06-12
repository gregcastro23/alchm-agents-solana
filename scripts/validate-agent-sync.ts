/**
 * Validate Agent Data Consistency
 *
 * This script validates data consistency across three sources:
 * 1. Agent TypeScript definitions (lib/agents/historical/*.ts)
 * 2. Neon PostgreSQL database (historical_agents table)
 * 3. ChromaDB vector store (historical_agents collection)
 *
 * Usage:
 *   npx tsx scripts/validate-agent-sync.ts
 */

import { PrismaClient } from '@prisma/client'
import { HISTORICAL_AGENTS } from '../lib/agents/historical/index'
import { ChromaClient } from 'chromadb'

const prisma = new PrismaClient()
const chromaUrl = process.env.CHROMADB_URL || 'http://localhost:8001'

interface ValidationResult {
  source: string
  count: number
  agents: Set<string>
  issues: string[]
}

async function validateAgentSync() {
  console.log('\n🔍 Validating Agent Data Consistency\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const results: Record<string, ValidationResult> = {
    typescript: {
      source: 'TypeScript Definitions',
      count: 0,
      agents: new Set(),
      issues: [],
    },
    neon: {
      source: 'Neon PostgreSQL',
      count: 0,
      agents: new Set(),
      issues: [],
    },
    chroma: {
      source: 'ChromaDB',
      count: 0,
      agents: new Set(),
      issues: [],
    },
  }

  // 1. Validate TypeScript Definitions
  console.log('📁 Checking TypeScript Definitions...')
  results.typescript.count = HISTORICAL_AGENTS.length
  HISTORICAL_AGENTS.forEach(agent => {
    results.typescript.agents.add(agent.id)

    // Validate required fields
    if (!agent.name) results.typescript.issues.push(`${agent.id}: Missing name`)
    if (!agent.consciousness) results.typescript.issues.push(`${agent.id}: Missing consciousness`)
    if (!agent.personality) results.typescript.issues.push(`${agent.id}: Missing personality`)
  })
  console.log(`   ✓ Found ${results.typescript.count} agents\n`)

  // 2. Validate Neon Database
  console.log('🗄️  Checking Neon Database...')
  try {
    const dbAgents = await prisma.historical_agents.findMany({
      select: {
        agentId: true,
        name: true,
        birthYear: true,
        consciousnessLevel: true,
        isActive: true,
      },
    })

    results.neon.count = dbAgents.length
    dbAgents.forEach(agent => {
      results.neon.agents.add(agent.agentId)

      // Validate data integrity
      if (!agent.name) results.neon.issues.push(`${agent.agentId}: Missing name`)
      if (!agent.consciousnessLevel)
        results.neon.issues.push(`${agent.agentId}: Missing consciousnessLevel`)
      if (agent.birthYear === 0) results.neon.issues.push(`${agent.agentId}: Invalid birthYear (0)`)
    })

    console.log(`   ✓ Found ${results.neon.count} agents`)
    console.log(`   Active: ${dbAgents.filter(a => a.isActive).length}`)
    console.log(`   Inactive: ${dbAgents.filter(a => !a.isActive).length}\n`)
  } catch (error) {
    results.neon.issues.push(
      `Database connection error: ${error instanceof Error ? error.message : String(error)}`
    )
    console.log(`   ✗ Error connecting to database\n`)
  }

  // 3. Validate ChromaDB
  console.log('🔮 Checking ChromaDB...')
  try {
    const chroma = new ChromaClient({ path: chromaUrl })
    const collection = await chroma.getCollection({ name: 'historical_agents' })
    const chromaData = await collection.get()

    // Extract unique agent IDs from ChromaDB metadata
    const chromaAgentIds = new Set<string>()
    if (chromaData.metadatas) {
      chromaData.metadatas.forEach(metadata => {
        if (metadata && typeof metadata === 'object' && 'agentId' in metadata) {
          chromaAgentIds.add(String(metadata.agentId))
        }
      })
    }

    results.chroma.count = chromaData.ids.length
    results.chroma.agents = chromaAgentIds

    console.log(`   ✓ Found ${results.chroma.count} documents`)
    console.log(`   Unique agents: ${chromaAgentIds.size}\n`)
  } catch (error) {
    results.chroma.issues.push(
      `ChromaDB connection error: ${error instanceof Error ? error.message : String(error)}`
    )
    console.log(`   ✗ Error connecting to ChromaDB\n`)
  }

  // Compare Results
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📊 Consistency Analysis:\n')

  // Agents in TypeScript but not in Neon
  const missingInNeon = [...results.typescript.agents].filter(id => !results.neon.agents.has(id))
  if (missingInNeon.length > 0) {
    console.log(`⚠️  Agents in TypeScript but NOT in Neon (${missingInNeon.length}):`)
    missingInNeon.forEach(id => console.log(`   - ${id}`))
    console.log()
  }

  // Agents in TypeScript but not in ChromaDB
  const missingInChroma = [...results.typescript.agents].filter(
    id => !results.chroma.agents.has(id)
  )
  if (missingInChroma.length > 0) {
    console.log(`⚠️  Agents in TypeScript but NOT in ChromaDB (${missingInChroma.length}):`)
    missingInChroma.forEach(id => console.log(`   - ${id}`))
    console.log()
  }

  // Agents in Neon but not in TypeScript (unexpected)
  const extraInNeon = [...results.neon.agents].filter(id => !results.typescript.agents.has(id))
  if (extraInNeon.length > 0) {
    console.log(`⚠️  Agents in Neon but NOT in TypeScript (${extraInNeon.length}):`)
    extraInNeon.forEach(id => console.log(`   - ${id}`))
    console.log()
  }

  // Agents in ChromaDB but not in TypeScript (stale data)
  const extraInChroma = [...results.chroma.agents].filter(id => !results.typescript.agents.has(id))
  if (extraInChroma.length > 0) {
    console.log(
      `⚠️  Agents in ChromaDB but NOT in TypeScript (${extraInChroma.length}) [STALE DATA]:`
    )
    extraInChroma.forEach(id => console.log(`   - ${id}`))
    console.log()
  }

  // Data Issues
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('🔍 Data Quality Issues:\n')

  let totalIssues = 0

  Object.values(results).forEach(result => {
    if (result.issues.length > 0) {
      console.log(`${result.source}:`)
      result.issues.forEach(issue => console.log(`   ⚠️ ${issue}`))
      console.log()
      totalIssues += result.issues.length
    }
  })

  if (totalIssues === 0) {
    console.log('✅ No data quality issues found!\n')
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📋 Summary:\n')
  console.log(`   TypeScript Definitions: ${results.typescript.count} agents`)
  console.log(`   Neon Database:          ${results.neon.count} agents`)
  console.log(
    `   ChromaDB:               ${results.chroma.agents.size} unique agents (${results.chroma.count} documents)`
  )
  console.log()

  const allInSync =
    missingInNeon.length === 0 &&
    missingInChroma.length === 0 &&
    extraInNeon.length === 0 &&
    extraInChroma.length === 0 &&
    totalIssues === 0

  if (allInSync) {
    console.log('✅ All systems are in sync!\n')
  } else {
    console.log('⚠️  Systems are OUT OF SYNC - action required\n')

    // Recommendations
    console.log('📝 Recommendations:\n')

    if (missingInNeon.length > 0) {
      console.log('   1. Run seed script to populate missing agents in Neon:')
      console.log('      npx tsx scripts/seed-historical-agents.ts\n')
    }

    if (missingInChroma.length > 0 || extraInChroma.length > 0) {
      console.log('   2. Clear and resync ChromaDB:')
      console.log('      # Clear stale data')
      console.log(
        "      npx tsx -e \"import { ChromaClient } from 'chromadb'; const client = new ChromaClient({ path: 'http://localhost:8001' }); await client.deleteCollection({ name: 'historical_agents' }); console.log('✓ Deleted');\""
      )
      console.log()
      console.log('      # Re-ingest from Neon')
      console.log(
        '      OPENAI_API_KEY=$OPENAI_API_KEY CHROMADB_URL=http://localhost:8001 npx tsx lib/llamaindex/ingestion-pipeline.ts --force\n'
      )
    }
  }

  await prisma.$disconnect()
}

validateAgentSync().catch(error => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
