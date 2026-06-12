#!/usr/bin/env node

/**
 * Generate Galileo Logs Script
 * Creates a burst of tracking events to populate Galileo with our new structure
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

async function generateGalileoLogs() {
  console.log('🚀 Generating Galileo Logs with Tags & Metadata Structure\n')

  const events = []

  try {
    // Generate multiple alchemical tracking events
    console.log('📊 Generating alchemical quantities tracking events...')
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${BASE_URL}/api/site-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'track_alchemical_quantities' }),
      })

      if (response.ok) {
        events.push(`Alchemical tracking ${i + 1}`)
        console.log(`✅ Alchemical tracking event ${i + 1} sent`)
      }

      // Small delay between events
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Generate planetary agent interaction events
    console.log('\n🤖 Generating planetary agent interaction events...')
    const planets = ['Mars', 'Venus', 'Jupiter', 'Saturn', 'Mercury']
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo']

    for (let i = 0; i < 5; i++) {
      const planet = planets[i % planets.length]
      const sign = signs[i % signs.length]

      const response = await fetch(`${BASE_URL}/api/site-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_planetary_agent_interaction',
          data: {
            planet,
            sign,
            degree: `${15 + i}°`,
            userQuery: `What is ${planet} like in ${sign}?`,
            aiResponse: `${planet} in ${sign} represents...`,
            responseTime: 1000 + i * 100,
            userId: `user-${i + 1}`,
          },
        }),
      })

      if (response.ok) {
        events.push(`Planetary interaction ${planet} in ${sign}`)
        console.log(`✅ Planetary interaction event: ${planet} in ${sign}`)
      }

      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Generate custom events
    console.log('\n🎯 Generating custom events...')
    const customEvents = [
      { name: 'user_registration', data: { method: 'email', source: 'landing_page' } },
      { name: 'feature_usage', data: { feature: 'alchm_calculator', action: 'calculate' } },
      { name: 'error_occurred', data: { error_type: 'api_timeout', endpoint: '/api/test' } },
      { name: 'user_preference', data: { theme: 'dark', language: 'en' } },
      { name: 'system_event', data: { event: 'backup_completed', size: '2.5GB' } },
    ]

    for (let i = 0; i < customEvents.length; i++) {
      const event = customEvents[i]
      const response = await fetch(`${BASE_URL}/api/site-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_custom_event',
          data: {
            eventName: event.name,
            eventData: event.data,
            userId: `user-${i + 10}`,
          },
        }),
      })

      if (response.ok) {
        events.push(`Custom event: ${event.name}`)
        console.log(`✅ Custom event: ${event.name}`)
      }

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Generate performance events
    console.log('\n⚡ Generating performance events...')
    const performanceMetrics = [
      { name: 'api_response_time', value: 150, unit: 'ms' },
      { name: 'page_load_time', value: 1200, unit: 'ms' },
      { name: 'database_query_time', value: 45, unit: 'ms' },
      { name: 'memory_usage', value: 256, unit: 'MB' },
      { name: 'cpu_usage', value: 15, unit: '%' },
    ]

    for (let i = 0; i < performanceMetrics.length; i++) {
      const metric = performanceMetrics[i]
      const response = await fetch(`${BASE_URL}/api/site-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_performance',
          data: {
            metricName: metric.name,
            value: metric.value,
            unit: metric.unit,
            additionalData: {
              timestamp: new Date().toISOString(),
              source: 'performance_monitor',
            },
          },
        }),
      })

      if (response.ok) {
        events.push(`Performance: ${metric.name}`)
        console.log(`✅ Performance event: ${metric.name} = ${metric.value}${metric.unit}`)
      }

      await new Promise(resolve => setTimeout(resolve, 150))
    }

    // Generate page view events
    console.log('\n📄 Generating page view events...')
    const pages = [
      '/site-metrics',
      '/planetary-agents',
      '/alchm-quantities',
      '/chart-interpreter',
      '/personalized-ai',
    ]

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const response = await fetch(`${BASE_URL}/api/site-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track_page_view',
          data: {
            page,
            referrer: i > 0 ? pages[i - 1] : 'direct',
            userId: `user-${i + 20}`,
            sessionId: `session-${Math.floor(i / 2) + 1}`,
          },
        }),
      })

      if (response.ok) {
        events.push(`Page view: ${page}`)
        console.log(`✅ Page view event: ${page}`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Final summary
    console.log('\n🎉 Galileo Log Generation Complete!')
    console.log(`\n📈 Generated ${events.length} tracking events:`)
    events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event}`)
    })

    console.log('\n🔍 Check your Galileo dashboard for:')
    console.log('   • Tags: alchemical_quantities, planetary_agents, astrological_data, etc.')
    console.log('   • Metadata: Alchemy_Effects_Total_Spirit, Heat, Dominant_Element, etc.')
    console.log(
      '   • Event types: alchemical_quantities, planetary_agent_interaction, custom_event, etc.'
    )
    console.log('   • Source: site-metrics-tracker')

    console.log('\n📊 Expected Galileo Log Structure:')
    console.log('   {')
    console.log('     event_type: "alchemical_quantities",')
    console.log('     tags: ["alchemical_quantities", "element_fire", ...],')
    console.log('     metadata: {')
    console.log('       "Alchemy_Effects_Total_Spirit": 4.58,')
    console.log('       "Heat": 0.0387,')
    console.log('       "Dominant_Element": "Fire",')
    console.log('       ...')
    console.log('     },')
    console.log('     source: "site-metrics-tracker"')
    console.log('   }')
  } catch (error) {
    console.error('\n❌ Error generating Galileo logs:', error.message)
    console.error('\n🔧 Make sure:')
    console.error('   • Development server is running (yarn dev)')
    console.error('   • Galileo environment variables are set')
    console.error('   • API endpoints are accessible')

    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  generateGalileoLogs()
}

module.exports = { generateGalileoLogs }
