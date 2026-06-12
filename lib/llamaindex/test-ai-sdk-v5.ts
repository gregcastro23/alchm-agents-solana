/**
 * Test AI SDK v5 - Simple Generation Test
 * Verify basic generateText functionality
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

async function testAISDK() {
  console.log('🧪 Testing AI SDK v5 - Basic Generation\n')
  console.log('━'.repeat(60))

  // Check if API key is set
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log(`API Key present: ${apiKey ? 'Yes' : 'No'}`)
  console.log(`API Key starts with: ${apiKey?.substring(0, 15)}...`)
  console.log('')

  try {
    console.log('Testing simple Claude generation...\n')

    const result = await generateText({
      model: anthropic('claude-3-5-sonnet-20240620'), // Use older model version for compatibility
      messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
      maxOutputTokens: 50,
    })

    console.log('✅ Generation successful!')
    console.log(`Response: "${result.text}"`)
    console.log(`Tokens used: ${result.usage?.totalTokens}`)
    console.log('')

    return true
  } catch (error) {
    console.error('❌ Generation failed:', error)

    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)

      // Check if it's an API key error
      if (error.message.includes('api-key') || error.message.includes('authentication')) {
        console.error('\n⚠️  API Key Issue Detected')
        console.error('The Anthropic API key may be invalid, expired, or missing.')
        console.error('Please check .env.local and ensure ANTHROPIC_API_KEY is set correctly.')
        console.error('\nAPI keys should start with: sk-ant-api03-')
      }
    }

    return false
  }
}

// Run test
testAISDK()
  .then(success => {
    console.log('\n━'.repeat(60))
    if (success) {
      console.log('✅ AI SDK v5 is working correctly!\n')
      process.exit(0)
    } else {
      console.log('❌ AI SDK v5 test failed. Check errors above.\n')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Test execution error:', error)
    process.exit(1)
  })
