import { temporalAnalysisTool, multiAgentCoordinatorTool } from '../lib/langchain/agent-tools'
import { logger } from '../lib/structured-logger'
import { AgentExecutor, createReactAgent } from 'langchain/agents'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

const TEST_ITERATIONS = 5

async function runStressTest() {
  console.log('Starting Temporal Analysis + Swisseph Stress Test in Bun')
  const startTime = Date.now()
  let successCount = 0

  // The goal is to stress test temporal analysis engine which uses swisseph.
  // We will call the tool multiple times concurrently and sequentially to see if Bun handles it.

  const queries = [
    'When were Carl Jung and Albert Einstein most aligned in Fire energy during the 1920s?',
    'Show Water reinforcements during Renaissance creativity peaks for Leonardo da Vinci and William Shakespeare',
    'Analyze consciousness evolution spikes across Nikola Tesla and Marie Curie in the late 19th century',
    'Find elemental harmony patterns in recent observations for all default agents',
    'Compare agent resonance during different planetary hours for Einstein, Jung, and Tesla in 1945',
  ]

  const tool = temporalAnalysisTool

  // 1. Sequential calls
  console.log('--- Sequential Test ---')
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const query = queries[i % queries.length]
    console.log(`[Seq Iteration ${i + 1}] Query: ${query.substring(0, 50)}...`)
    const iterStart = Date.now()
    try {
      const res = await tool.func({ query, agents: null, elements: null })
      const data = JSON.parse(res)
      if (data.success) {
        successCount++
        console.log(`  Success! Took ${Date.now() - iterStart}ms`)
      } else {
        console.error(`  Failed: ${res}`)
      }
    } catch (e) {
      console.error(`  Error in sequential execution:`, e)
    }
  }

  // 2. Concurrent calls (Stress test for C-binding blocking)
  console.log('--- Concurrent Test ---')
  console.log(`Running ${TEST_ITERATIONS} queries concurrently...`)

  const promises = []
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const query = queries[i % queries.length]
    promises.push(
      tool
        .func({ query, agents: null, elements: null })
        .then(res => {
          const data = JSON.parse(res)
          return data.success
        })
        .catch(e => {
          console.error(`Error in concurrent execution ${i}:`, e)
          return false
        })
    )
  }

  const results = await Promise.all(promises)
  const concurrentSuccess = results.filter(r => r).length
  console.log(`Concurrent results: ${concurrentSuccess}/${TEST_ITERATIONS} succeeded.`)
  successCount += concurrentSuccess

  console.log(`Stress test completed in ${Date.now() - startTime}ms`)
  console.log(`Total Success: ${successCount}/${TEST_ITERATIONS * 2}`)

  process.exit(successCount === TEST_ITERATIONS * 2 ? 0 : 1)
}

runStressTest().catch(console.error)
