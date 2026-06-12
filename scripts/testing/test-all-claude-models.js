#!/usr/bin/env node
/**
 * Test all available Claude models to find which ones work with your API key
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const models = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
]

async function testModel(apiKey, modelName) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })

    if (response.ok) {
      return { model: modelName, status: '✅ WORKS', available: true }
    } else {
      const error = await response.json()
      return {
        model: modelName,
        status: `❌ ${response.status}`,
        available: false,
        error: error.error?.type,
      }
    }
  } catch (error) {
    return { model: modelName, status: '❌ ERROR', available: false, error: error.message }
  }
}

async function testAllModels() {
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    'sk-placeholder-key-redacted'

  console.log('🔍 Testing all Claude models with your API key...\n')

  const results = []
  for (const model of models) {
    process.stdout.write(`Testing ${model}... `)
    const result = await testModel(apiKey, model)
    console.log(result.status)
    results.push(result)
  }

  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  const working = results.filter(r => r.available)
  const notWorking = results.filter(r => !r.available)

  if (working.length > 0) {
    console.log('\n✅ AVAILABLE MODELS:')
    working.forEach(r => console.log(`   • ${r.model}`))
  }

  if (notWorking.length > 0) {
    console.log('\n❌ UNAVAILABLE MODELS:')
    notWorking.forEach(r => console.log(`   • ${r.model} (${r.error || 'not_found'})`))
  }

  if (working.length > 0) {
    console.log('\n🎉 RECOMMENDED ACTION:')
    console.log(`Update your .env.local with this working model:`)
    console.log(`\nCLAUDE_DEFAULT_MODEL=${working[0].model}`)
    console.log(`CLAUDE_FAST_MODEL=${working[0].model}`)
  } else {
    console.log('\n⚠️  NO MODELS AVAILABLE!')
    console.log('\n📝 SOLUTIONS:')
    console.log('1. Request API access from Anthropic:')
    console.log('   • Go to https://console.anthropic.com/')
    console.log('   • Check your organization settings')
    console.log('   • Contact support@anthropic.com if needed')
    console.log('\n2. Use OpenAI as fallback:')
    console.log('   • Set OPENAI_API_KEY in .env.local')
    console.log('   • The app will automatically use OpenAI models')
  }
}

testAllModels()
