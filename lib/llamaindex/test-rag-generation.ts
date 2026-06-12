/**
 * Test RAG Generation
 * Verify end-to-end RAG pipeline: retrieval + generation
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { generateWithRAG } from '../rag/rag-generator'

async function testRAGGeneration() {
  console.log('🧪 Testing RAG Generation System\n')
  console.log('━'.repeat(60))

  try {
    // Test 1: Simple question about philosophy
    console.log('\n1️⃣ Test: Philosophy Question')
    console.log('Query: "What is the essence of Socratic wisdom?"\n')

    const result1 = await generateWithRAG({
      agent: { name: 'Test User' },
      agentId: 'test-user',
      userMessage: 'What is the essence of Socratic wisdom?',
      systemPrompt:
        'You are a helpful assistant that provides insightful answers based on historical knowledge.',
      ragConfig: {
        enabled: true,
        topK: 5,
        threshold: 0.35,
        useReranking: true,
      },
    })

    console.log('✅ RAG Response Generated:')
    console.log(`   RAG Used: ${result1.ragMetadata.ragUsed}`)
    console.log(`   Retrieved Docs: ${result1.ragMetadata.retrievedDocs || 0}`)
    console.log(`   Response length: ${result1.text.length} chars`)
    console.log(`\n   Response preview:\n   "${result1.text.substring(0, 200)}..."\n`)

    if (result1.ragMetadata.sources && result1.ragMetadata.sources.length > 0) {
      console.log('   Top sources:')
      result1.ragMetadata.sources.slice(0, 3).forEach((source, i) => {
        console.log(
          `   ${i + 1}. ${source.agentName} (${(source.relevance * 100).toFixed(1)}% relevant)`
        )
      })
    }

    // Test 2: Scientific discovery question
    console.log('\n2️⃣ Test: Scientific Discovery Question')
    console.log('Query: "How did Marie Curie approach scientific research?"\n')

    const result2 = await generateWithRAG({
      agent: { name: 'Test User' },
      agentId: 'marie-curie-1867',
      userMessage: 'How did Marie Curie approach scientific research?',
      systemPrompt:
        'You are a helpful assistant that provides insightful answers based on historical knowledge.',
      ragConfig: {
        enabled: true,
        topK: 5,
        threshold: 0.35,
        useReranking: true,
      },
    })

    console.log('✅ RAG Response Generated:')
    console.log(`   RAG Used: ${result2.ragMetadata.ragUsed}`)
    console.log(`   Retrieved Docs: ${result2.ragMetadata.retrievedDocs || 0}`)
    console.log(`   Response length: ${result2.text.length} chars`)
    console.log(`\n   Response preview:\n   "${result2.text.substring(0, 200)}..."\n`)

    if (result2.ragMetadata.sources && result2.ragMetadata.sources.length > 0) {
      console.log('   Top sources:')
      result2.ragMetadata.sources.slice(0, 3).forEach((source, i) => {
        console.log(
          `   ${i + 1}. ${source.agentName} (${(source.relevance * 100).toFixed(1)}% relevant)`
        )
      })
    }

    // Test 3: Creative arts question
    console.log('\n3️⃣ Test: Creative Arts Question')
    console.log('Query: "What can we learn from Leonardo da Vinci about creativity?"\n')

    const result3 = await generateWithRAG({
      agent: { name: 'Test User' },
      agentId: 'leonardo-da-vinci',
      userMessage: 'What can we learn from Leonardo da Vinci about creativity?',
      systemPrompt:
        'You are a helpful assistant that provides insightful answers based on historical knowledge.',
      ragConfig: {
        enabled: true,
        topK: 5,
        threshold: 0.35,
        useReranking: true,
      },
    })

    console.log('✅ RAG Response Generated:')
    console.log(`   RAG Used: ${result3.ragMetadata.ragUsed}`)
    console.log(`   Retrieved Docs: ${result3.ragMetadata.retrievedDocs || 0}`)
    console.log(`   Response length: ${result3.text.length} chars`)
    console.log(`\n   Response preview:\n   "${result3.text.substring(0, 200)}..."\n`)

    if (result3.ragMetadata.sources && result3.ragMetadata.sources.length > 0) {
      console.log('   Top sources:')
      result3.ragMetadata.sources.slice(0, 3).forEach((source, i) => {
        console.log(
          `   ${i + 1}. ${source.agentName} (${(source.relevance * 100).toFixed(1)}% relevant)`
        )
      })
    }

    // Summary
    console.log('\n━'.repeat(60))
    console.log('✅ All RAG Generation Tests Passed!\n')
    console.log('Summary:')
    console.log(
      `  Test 1: ${result1.ragMetadata.sources?.length || 0} sources, ${result1.text.length} chars`
    )
    console.log(
      `  Test 2: ${result2.ragMetadata.sources?.length || 0} sources, ${result2.text.length} chars`
    )
    console.log(
      `  Test 3: ${result3.ragMetadata.sources?.length || 0} sources, ${result3.text.length} chars`
    )
    console.log('')

    return true
  } catch (error) {
    console.error('\n❌ Test Failed:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Stack:', error.stack)
    }
    return false
  }
}

// Run tests
testRAGGeneration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution error:', error)
    process.exit(1)
  })
