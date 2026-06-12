#!/usr/bin/env node

/**
 * Vercel Environment Variables Checker
 *
 * This script helps you check your current environment variable setup
 * and provides guidance on what needs to be configured.
 */

console.log('\n🔍 Planetary Agents - Vercel Environment Variables Checker\n')

// Read the vercel-env-variables.env file
const fs = require('fs')
const path = require('path')

const envFile = path.join(__dirname, 'vercel-env-variables.env')

if (!fs.existsSync(envFile)) {
  console.error('❌ vercel-env-variables.env not found!')
  process.exit(1)
}

const envContent = fs.readFileSync(envFile, 'utf-8')
const lines = envContent.split('\n')

// Parse environment variables
const envVars = {}
const comments = {}

lines.forEach(line => {
  // Skip empty lines and comments
  if (!line.trim() || line.trim().startsWith('#')) return

  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    envVars[key] = value
  }
})

// Required variables for minimum setup
const requiredVars = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS',
]

console.log('📋 Required Variables Status:\n')

requiredVars.forEach(varName => {
  const exists = !!envVars[varName]
  const value = envVars[varName]

  // Check if value needs attention
  let status = ''
  let issue = ''

  if (!exists) {
    status = '❌ MISSING'
    issue = 'Variable not found in configuration'
  } else if (varName === 'DATABASE_URL' && value.includes('${POSTGRES_PRISMA_URL}')) {
    status = '⚠️  PLACEHOLDER'
    issue = 'Needs actual database URL (check your Prisma or database provider)'
  } else if (value === 'your-secret-here' || value === '' || value === 'placeholder') {
    status = '⚠️  PLACEHOLDER'
    issue = 'Needs actual value'
  } else if (varName === 'DATABASE_URL' && value.length > 0) {
    status = '✅ CONFIGURED'
    issue = `maybe ready - verify connection`
  } else {
    status = '✅ CONFIGURED'
    issue = 'Value present'
  }

  console.log(`${status.padEnd(15)} ${varName}`)
  if (issue) {
    console.log(`${' '.repeat(16)} → ${issue}`)
  }
  console.log()
})

// Summary
const missing = requiredVars.filter(v => !envVars[v])
const placeholders = requiredVars.filter(v => {
  const val = envVars[v]
  return (
    val && (val.includes('${') || val === 'your-secret-here' || val === '' || val === 'placeholder')
  )
})

console.log('\n' + '='.repeat(60) + '\n')
console.log('📊 Summary:\n')

if (missing.length === 0 && placeholders.length === 0) {
  console.log('✅ All required variables are configured!')
  console.log('\n📝 Next Steps:')
  console.log('   1. Add these variables to your Vercel dashboard')
  console.log('   2. Go to: Settings → Environment Variables')
  console.log('   3. Redeploy your application')
  console.log('\n📖 See VERCEL_SETUP_SUMMARY.md for step-by-step instructions')
} else {
  if (missing.length > 0) {
    console.log(`❌ Missing variables: ${missing.join(', ')}`)
  }
  if (placeholders.length > 0) {
    console.log(`⚠️  Variables needing real values: ${placeholders.join(', ')}`)
  }
  console.log('\n📖 See VERCEL_SETUP_SUMMARY.md for help setting these up')
}

// Check DATABASE_URL specifically
if (envVars.DATABASE_URL) {
  console.log('\n' + '='.repeat(60) + '\n')
  console.log('💾 DATABASE_URL Details:\n')

  const dbUrl = envVars.DATABASE_URL

  if (dbUrl.includes('${POSTGRES_PRISMA_URL}')) {
    console.log('⚠️  Placeholder detected: ${POSTGRES_PRISMA_URL}')
    console.log('\n📝 To fix:')
    console.log('   Option 1: Set up Prisma Accelerate')
    console.log('   → Go to https://console.prisma.io')
    console.log('   → Create or connect your project')
    console.log('   → Enable Accelerate and copy the connection string')
    console.log('\n   Option 2: Use direct PostgreSQL')
    spring.log('   → Format: postgresql://user:pass@host:port/database')
  } else if (dbUrl.startsWith('prisma://')) {
    console.log('✅ Prisma Accelerate connection detected')
    console.log('   → Format: prisma://accelerate.prisma-data.net/?api_key=...')
    console.log('   → This is the recommended setup for production')
  } else if (dbUrl.startsWith('postgresql://')) {
    console.log('✅ Direct PostgreSQL connection detected')
    console.log('   → Format: postgresql://user:pass@host:port/database')
    console.log('   → Verify the database is accessible from Vercel')
  } else {
    console.log('⚠️  Unknown DATABASE_URL format')
    console.log('   → Expected: postgresql:// or prisma://')
  }
}

// Check NEXTAUTH_SECRET
if (envVars.NEXTAUTH_SECRET) {
  console.log('\n' + '='.repeat(60) + '\n')
  console.log('🔐 NEXTAUTH_SECRET Status:\n')

  const secret = envVars.NEXTAUTH_SECRET

  if (secret === 'BwPncOutL5ZNLFCPR3BU8DzD86PYIK1gm3UjzQThEg0=') {
    console.log('✅ Fresh secret generated (2025-09-19)')
    console.log('   → This is ready to use')
  } else if (secret.length >= 32) {
    console.log('✅ Secret configured')
    console.log('   → Secret length looks good')
  } else {
    console.log('⚠️  Secret may be too short')
    console.log('   → Recommended: at least 32 characters')
  }
}

console.log('\n' + '='.repeat(60) + '\n')
console.log('📚 Documentation:')
console.log('   • VERCEL_SETUP_SUMMARY.md - Quick start guide')
console.log('   • VERCEL_ENV_SETUP_GUIDE.md - Detailed documentation')
console.log('   • vercel-env-variables.env - All environment variables')
console.log('\n')
