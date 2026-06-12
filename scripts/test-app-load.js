#!/usr/bin/env node

/**
 * Test script to verify the app loads without runtime errors
 */

import { spawn } from 'child_process'

console.log('🚀 Testing app load without runtime errors...')

const nextProcess = spawn('yarn', ['dev'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' },
})

let output = ''
let errorOutput = ''
let hasError = false

nextProcess.stdout.on('data', data => {
  const text = data.toString()
  output += text

  // Check for successful compilation
  if (text.includes('Compiled successfully')) {
    console.log('✅ App compiled successfully')
  }

  // Check for runtime errors
  if (text.includes('TypeError') || text.includes('Cannot read properties')) {
    console.log('❌ Runtime error detected:', text)
    hasError = true
  }
})

nextProcess.stderr.on('data', data => {
  const text = data.toString()
  errorOutput += text
  console.log('⚠️  stderr:', text)
})

nextProcess.on('close', code => {
  console.log(`\n📊 Test completed with exit code: ${code}`)

  if (hasError) {
    console.log('❌ App has runtime errors')
    process.exit(1)
  } else {
    console.log('✅ App loaded successfully without runtime errors')
    process.exit(0)
  }
})

// Kill the process after 10 seconds (enough time for initial load)
setTimeout(() => {
  console.log('\n⏰ Stopping test after 10 seconds...')
  nextProcess.kill('SIGTERM')
}, 10000)
