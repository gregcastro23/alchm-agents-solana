#!/usr/bin/env node
/**
 * Test script to verify Anthropic API key has model access
 * Usage: node test-anthropic-key.js
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testAnthropicKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in .env.local')
    console.log('\n📝 Steps to fix:')
    console.log('1. Go to https://console.anthropic.com/')
    console.log('2. Create an API key')
    console.log('3. Add it to .env.local as ANTHROPIC_API_KEY=sk-ant-api03-...')
    process.exit(1)
  }

  console.log('🔍 Testing Anthropic API key...')
  console.log(`Key prefix: ${apiKey.substring(0, 20)}...`)

  try {
    // Test with a simple message
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      }),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ API key is valid and has model access!')
      console.log(`✅ Successfully connected to: ${data.model}`)
      console.log('\n🎉 Your Anthropic API is working correctly!')
      return
    }

    // Handle specific errors
    if (response.status === 404) {
      console.error('❌ 404 Error: Model not found or no access')
      console.log('\n🔧 Common causes:')
      console.log("1. Your API key doesn't have access to Claude 3.5 Sonnet")
      console.log('2. You need to request model access from Anthropic')
      console.log("3. Your organization hasn't been granted access yet")
      console.log('\n📝 Solution:')
      console.log('• Contact Anthropic support: support@anthropic.com')
      console.log('• Request access to Claude 3.5 models')
      console.log('• Or try an older model: claude-3-opus-20240229')
    } else if (response.status === 401) {
      console.error('❌ 401 Error: Invalid API key')
      console.log('\n📝 Solution:')
      console.log('• Check your API key is correct')
      console.log('• Regenerate a new key from https://console.anthropic.com/')
    } else {
      console.error(`❌ Error ${response.status}: ${data.error?.message || JSON.stringify(data)}`)
    }

    console.log('\n📊 Full error details:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('❌ Network error:', error.message)
    console.log('\n🔧 Check:')
    console.log('• Your internet connection')
    console.log('• Firewall settings')
    console.log('• API endpoint accessibility')
  }
}

testAnthropicKey()
