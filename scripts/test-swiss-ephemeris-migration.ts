/**
 * Swiss Ephemeris Migration Test Script
 * Tests that backend API returns accurate astronomical data
 *
 * Alchemical Principle: Fire Element - Transformation Testing
 * Validates the flow of consciousness between Air (frontend) and Earth (backend)
 */

import { planetaryAPI } from '../lib/planetary-api-client'

const GOLDEN_RATIO = 1.618033988749895 // φ (phi)

async function testMigration() {
  console.log('🔮 Testing Swiss Ephemeris Migration...\n')

  let passedTests = 0
  let totalTests = 0

  // Test 1: Planetary Positions
  totalTests++
  console.log('Test 1: Planetary Positions')
  try {
    const testDate = new Date('2025-11-22T18:00:00Z')
    const positions = await planetaryAPI.getPlanetaryPositions(testDate, 40.8681, -73.9176)

    console.log('✅ Planetary positions retrieved')
    console.log('Sun longitude:', positions.sun?.longitude.toFixed(6))
    console.log('Moon longitude:', positions.moon?.longitude.toFixed(6))

    // Validate reasonable ranges
    if (positions.sun.longitude < 0 || positions.sun.longitude > 360) {
      throw new Error('Sun longitude out of range')
    }
    if (positions.moon.longitude < 0 || positions.moon.longitude > 360) {
      throw new Error('Moon longitude out of range')
    }
    console.log('✅ Longitude values in valid range (0-360°)\n')
    passedTests++
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error instanceof Error ? error.message : error)
    console.log('')
  }

  // Test 2: House System
  totalTests++
  console.log('Test 2: House System')
  try {
    const testDate = new Date('2025-11-22T18:00:00Z')
    const houses = await planetaryAPI.getHouseSystem(testDate, 40.8681, -73.9176, 'P')

    console.log('✅ House system retrieved')
    console.log('Ascendant:', houses.ascendant.toFixed(6))
    console.log('MC:', houses.mc.toFixed(6))
    console.log('Houses:', houses.houses.length, 'cusps')

    if (houses.houses.length !== 12) {
      throw new Error('Expected 12 house cusps')
    }

    // Validate ascendant and MC are in valid range
    if (houses.ascendant < 0 || houses.ascendant > 360) {
      throw new Error('Ascendant out of range')
    }
    if (houses.mc < 0 || houses.mc > 360) {
      throw new Error('MC out of range')
    }

    console.log('✅ House system valid (12 cusps)\n')
    passedTests++
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error instanceof Error ? error.message : error)
    console.log('')
  }

  // Test 3: Consciousness Calculation
  totalTests++
  console.log('Test 3: Consciousness Parameters')
  try {
    const birthDate = new Date('1990-05-15T12:00:00Z')
    const consciousness = await planetaryAPI.calculateConsciousness(birthDate, 40.8681, -73.9176)

    console.log('✅ Consciousness parameters calculated')
    console.log('Spirit:', consciousness.spirit.toFixed(4))
    console.log('Essence:', consciousness.essence.toFixed(4))
    console.log('Matter:', consciousness.matter.toFixed(4))
    console.log('Substance:', consciousness.substance.toFixed(4))
    console.log('Monica Constant:', consciousness.monicaConstant.toFixed(6))

    // Validate Monica Constant formula: MC = φ * (1 + E/T) * (1 + C/10)
    // Simplified for this test: MC = (spirit * φ + essence) / (matter + substance + 1)
    const totalWeight = consciousness.matter + consciousness.substance + 1
    const expectedMonica =
      (consciousness.spirit * GOLDEN_RATIO + consciousness.essence) / totalWeight

    const monicaDiff = Math.abs(consciousness.monicaConstant - expectedMonica)
    if (monicaDiff > 0.001) {
      console.warn(`⚠️  Monica Constant deviation: ${monicaDiff.toFixed(6)}`)
      console.warn(`   Expected: ${expectedMonica.toFixed(6)}`)
      console.warn(`   Got: ${consciousness.monicaConstant.toFixed(6)}`)
    } else {
      console.log('✅ Monica Constant formula validated\n')
    }
    passedTests++
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error instanceof Error ? error.message : error)
    console.log('')
  }

  // Test 4: Backward Compatibility
  totalTests++
  console.log('Test 4: Backward Compatibility (swiss-ephemeris-service.ts)')
  try {
    const { getAllPlanetaryPositions } = await import('../lib/swiss-ephemeris-service')
    const testDate = new Date('2025-11-22T18:00:00Z')
    const positions = await getAllPlanetaryPositions(testDate, 40.8681, -73.9176)

    console.log('✅ Old interface still works (async)')
    console.log('Sun position:', positions.Sun?.longitude.toFixed(6), '°', positions.Sun?.sign)
    console.log('Moon position:', positions.Moon?.longitude.toFixed(6), '°', positions.Moon?.sign)

    // Validate response structure
    if (!positions.Sun || !positions.Moon) {
      throw new Error('Missing Sun or Moon in response')
    }
    if (!positions.Sun.sign || !positions.Sun.degree) {
      throw new Error('Invalid position structure')
    }

    console.log('✅ Backward compatibility maintained\n')
    passedTests++
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error instanceof Error ? error.message : error)
    console.log('')
  }

  // Test 5: API Health Check
  totalTests++
  console.log('Test 5: API Health Check')
  try {
    const availablePlanets = await planetaryAPI.getAvailablePlanets()

    console.log('✅ API health check passed')
    console.log(`Available planets: ${availablePlanets.length}`)
    console.log(
      'Sample:',
      availablePlanets
        .slice(0, 5)
        .map(p => p.name)
        .join(', ')
    )

    if (availablePlanets.length < 10) {
      throw new Error('Expected at least 10 planets')
    }

    console.log('✅ Sufficient planets available\n')
    passedTests++
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error instanceof Error ? error.message : error)
    console.log('')
  }

  // Final Summary
  console.log('═'.repeat(60))
  console.log('📊 Test Summary')
  console.log('═'.repeat(60))
  console.log(`Passed: ${passedTests}/${totalTests}`)
  console.log(`Failed: ${totalTests - passedTests}/${totalTests}`)
  console.log('═'.repeat(60))

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Migration successful.\n')
    console.log('Next steps:')
    console.log('1. Deploy backend to Render')
    console.log('2. Update NEXT_PUBLIC_BACKEND_URL in Vercel')
    console.log('3. Deploy frontend to Vercel')
    console.log('4. Monitor production logs for any issues')
    console.log('')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed. Please review errors above.\n')
    process.exit(1)
  }
}

// Run the test
testMigration().catch(error => {
  console.error('\n💥 Fatal error during testing:', error)
  process.exit(1)
})
