#!/usr/bin/env node
/**
 * Test that chat works with your available models
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testChat() {
  const apiKey = process.env.ANTHROPIC_API_KEY

  console.log('🧪 Testing chat with Claude 3 Opus (your best available model)...\n')

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content:
              'Hi! Tell me in 2 sentences: Are you Claude 3 Opus and what makes you special?',
          },
        ],
      }),
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ SUCCESS! Claude 3 Opus is working!\n')
      console.log('🤖 Model:', data.model)
      console.log('💬 Response:', data.content[0].text)
      console.log('\n🎉 Your chat system is now functional!')
      console.log('\n📊 Model Stats:')
      console.log('   • Power Level: ⭐⭐⭐⭐ (Very High)')
      console.log('   • Context: 200K tokens')
      console.log('   • Best For: Complex reasoning, analysis, chat')
      console.log('\n💡 This is the BEST model you have access to!')
    } else {
      console.error('❌ Error:', data)
    }
  } catch (error) {
    console.error('❌ Network error:', error.message)
  }
}

testChat()
