#!/usr/bin/env node
// This script updates the environment with Galileo settings

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Galileo configuration from the URL
const GALILEO_PROJECT = '1e7fd4a1-3e28-4fe1-a719-744f239a13be'
const GALILEO_LOG_STREAM = '6ed50263-a348-4ad6-ab63-bd04d3a4ffdd'

// Export environment variables at runtime
process.env.GALILEO_PROJECT = GALILEO_PROJECT
process.env.GALILEO_LOG_STREAM = GALILEO_LOG_STREAM

console.log('Environment variables set:')
console.log(`GALILEO_PROJECT=${process.env.GALILEO_PROJECT}`)
console.log(`GALILEO_LOG_STREAM=${process.env.GALILEO_LOG_STREAM}`)
console.log('')
console.log('API Key length:', process.env.GALILEO_API_KEY?.length || 0)
console.log('')

// Functions to test Galileo connection
async function testGalileoConnection() {
  const logData = {
    project: GALILEO_PROJECT,
    stream: GALILEO_LOG_STREAM,
    content: 'Test log message from update script',
    metadata: {
      source: 'update-script',
      timestamp: new Date().toISOString(),
      test: true,
    },
  }

  try {
    console.log('Testing connection to Galileo...')

    // Try the projects endpoint format
    const url = `https://api.galileo.ai/projects/${GALILEO_PROJECT}/logs/${GALILEO_LOG_STREAM}`
    console.log(`Trying URL: ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GALILEO_API_KEY}`,
      },
      body: JSON.stringify(logData),
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const text = await response.text()
      console.error('Error response:', text)

      // Try the observe endpoint format
      const fallbackUrl = `https://api.galileo.ai/v1/projects/${GALILEO_PROJECT}/observe/ingest`
      console.log(`\nTrying fallback URL: ${fallbackUrl}`)

      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GALILEO_API_KEY}`,
        },
        body: JSON.stringify(logData),
      })

      console.log(`Fallback response status: ${fallbackResponse.status}`)

      if (!fallbackResponse.ok) {
        const fallbackText = await fallbackResponse.text()
        console.error('Fallback error response:', fallbackText)
        return false
      }

      const fallbackData = await fallbackResponse.json()
      console.log('Success with fallback!', fallbackData)
      return true
    }

    const data = await response.json()
    console.log('Success!', data)
    return true
  } catch (error) {
    console.error('Error testing Galileo connection:', error)
    return false
  }
}

// Run the test
await testGalileoConnection()

// Export instructions for the user
console.log('\n----------------------------------------')
console.log('To use these environment variables:')
console.log('1. In development, run:')
console.log(
  '   node update-env.mjs && GALILEO_PROJECT=1e7fd4a1-3e28-4fe1-a719-744f239a13be GALILEO_LOG_STREAM=6ed50263-a348-4ad6-ab63-bd04d3a4ffdd yarn dev'
)
console.log('')
console.log('2. Or export them in your shell:')
console.log('   export GALILEO_PROJECT=1e7fd4a1-3e28-4fe1-a719-744f239a13be')
console.log('   export GALILEO_LOG_STREAM=6ed50263-a348-4ad6-ab63-bd04d3a4ffdd')
console.log('----------------------------------------')
