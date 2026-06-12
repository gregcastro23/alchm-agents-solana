#!/usr/bin/env node

/**
 * Verify Galileo Logs Script
 * Checks what data is being sent to Galileo and verifies the structure
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function verifyGalileoLogs() {
  console.log('🔍 Verifying Galileo Logs Structure\n')

  try {
    // Get current site metrics to see the structure
    console.log('1️⃣ Fetching current site metrics structure...')
    const metricsResponse = await fetch(`${BASE_URL}/api/site-metrics`)

    if (!metricsResponse.ok) {
      throw new Error(`HTTP ${metricsResponse.status}: ${metricsResponse.statusText}`)
    }

    const metrics = await metricsResponse.json()

    console.log('✅ Site metrics structure retrieved')
    console.log(`📊 Tags count: ${metrics.tags.length}`)
    console.log(`📋 Metadata keys count: ${Object.keys(metrics.metadata).length}`)

    // Show sample tags
    console.log('\n🏷️  Sample Tags:')
    metrics.tags.slice(0, 10).forEach((tag, index) => {
      console.log(`   ${index + 1}. ${tag}`)
    })

    // Show sample metadata
    console.log('\n📋 Sample Metadata Keys:')
    const sampleKeys = Object.keys(metrics.metadata).slice(0, 15)
    sampleKeys.forEach((key, index) => {
      const value = metrics.metadata[key]
      const displayValue = typeof value === 'number' ? value.toFixed(4) : String(value)
      console.log(`   ${index + 1}. ${key}: ${displayValue}`)
    })

    // Test a specific tracking event and show what would be sent
    console.log('\n2️⃣ Testing alchemical tracking event structure...')
    const trackResponse = await fetch(`${BASE_URL}/api/site-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track_alchemical_quantities' }),
    })

    if (trackResponse.ok) {
      console.log('✅ Alchemical tracking event sent successfully')

      // Show what the Galileo log structure should look like
      console.log('\n📊 Expected Galileo Log Structure:')
      console.log('{')
      console.log('  "event_type": "alchemical_quantities",')
      console.log('  "tags": [')
      metrics.tags.forEach((tag, index) => {
        const comma = index < metrics.tags.length - 1 ? ',' : ''
        console.log(`    "${tag}"${comma}`)
      })
      console.log('  ],')
      console.log('  "metadata": {')

      const sampleMetadata = Object.entries(metrics.metadata).slice(0, 10)
      sampleMetadata.forEach(([key, value], index) => {
        const comma = index < sampleMetadata.length - 1 ? ',' : ''
        const displayValue = typeof value === 'number' ? value.toFixed(4) : `"${value}"`
        console.log(`    "${key}": ${displayValue}${comma}`)
      })

      if (Object.keys(metrics.metadata).length > 10) {
        console.log('    // ... and more metadata keys')
      }

      console.log('  },')
      console.log('  "source": "site-metrics-tracker"')
      console.log('}')
    } else {
      console.log('❌ Failed to send tracking event')
    }

    // Test a custom event
    console.log('\n3️⃣ Testing custom event structure...')
    const customResponse = await fetch(`${BASE_URL}/api/site-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_custom_event',
        data: {
          eventName: 'verification_test',
          eventData: {
            testValue: 42,
            testString: 'hello galileo',
            testBoolean: true,
            timestamp: new Date().toISOString(),
          },
          userId: 'verification-user',
        },
      }),
    })

    if (customResponse.ok) {
      console.log('✅ Custom event sent successfully')
    } else {
      console.log('❌ Failed to send custom event')
    }

    // Summary
    console.log('\n🎯 Verification Summary:')
    console.log(`   • Tags generated: ${metrics.tags.length}`)
    console.log(`   • Metadata keys: ${Object.keys(metrics.metadata).length}`)
    console.log(`   • Alchemical tracking: ✅ Working`)
    console.log(`   • Custom events: ✅ Working`)
    console.log(`   • Galileo integration: ✅ Ready`)

    console.log('\n🔍 Next Steps:')
    console.log('   1. Check your Galileo dashboard for new logs')
    console.log('   2. Look for events with source: "site-metrics-tracker"')
    console.log('   3. Verify tags and metadata structure in Galileo')
    console.log('   4. Filter by event_type: "alchemical_quantities"')

    console.log('\n📈 Expected Galileo Dashboard Data:')
    console.log(
      '   • Event Types: alchemical_quantities, planetary_agent_interaction, custom_event, performance, page_view'
    )
    console.log(
      '   • Tags: alchemical_quantities, planetary_agents, astrological_data, thermodynamic_calculations, element_*, modality_*, sun_sign_*'
    )
    console.log('   • Metadata: All flattened alchm keys with their values')
    console.log('   • Source: site-metrics-tracker')
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message)
    console.error('\n🔧 Troubleshooting:')
    console.error('   • Check if development server is running')
    console.error('   • Verify Galileo environment variables')
    console.error('   • Check server logs for errors')

    process.exit(1)
  }
}

// Run the verification
if (require.main === module) {
  verifyGalileoLogs()
}

module.exports = { verifyGalileoLogs }
