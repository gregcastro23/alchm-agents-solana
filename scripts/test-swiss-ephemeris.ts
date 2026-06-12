/**
 * Test Swiss Ephemeris planetary positions
 */

import { swissEphemerisService } from '../lib/swiss-ephemeris-service'

// Test for current date (November 18, 2025)
const testDate = new Date('2025-11-18T18:00:00Z')

console.log('Testing Swiss Ephemeris for:', testDate.toISOString())
console.log('='.repeat(80))

const positions = swissEphemerisService.getAllPlanetaryPositions(testDate)

console.log('\nPlanetary Positions:\n')

// Expected values from user (November 18, 2025):
const expectedPositions = {
  Sun: { sign: 'Scorpio', degree: 26.57 },
  Moon: { sign: 'Scorpio', degree: 8.88 },
  Mercury: { sign: 'Sagittarius', degree: 0.63, retrograde: true },
  Venus: { sign: 'Scorpio', degree: 14.7 },
  Mars: { sign: 'Sagittarius', degree: 10.22 },
  Jupiter: { sign: 'Cancer', degree: 25.07, retrograde: true },
  Saturn: { sign: 'Pisces', degree: 25.23, retrograde: true },
  Uranus: { sign: 'Taurus', degree: 29.57, retrograde: true },
  Neptune: { sign: 'Pisces', degree: 29.53, retrograde: true },
  Pluto: { sign: 'Aquarius', degree: 1.82 },
}

// Display results and compare
for (const [planet, expected] of Object.entries(expectedPositions)) {
  const actual = positions[planet]

  if (actual) {
    const degreeMatch = Math.abs(actual.degree - expected.degree) < 1.0
    const signMatch = actual.sign === expected.sign
    const retrogradeMatch =
      expected.retrograde === undefined || actual.retrograde === expected.retrograde

    const status = degreeMatch && signMatch && retrogradeMatch ? '✅' : '❌'

    console.log(`${status} ${planet}:`)
    console.log(
      `   Expected: ${expected.sign} ${expected.degree.toFixed(2)}°${expected.retrograde ? ' (R)' : ''}`
    )
    console.log(
      `   Actual:   ${actual.sign} ${actual.degree.toFixed(2)}°${actual.retrograde ? ' (R)' : ''}`
    )
    console.log(`   Diff:     ${(actual.degree - expected.degree).toFixed(4)}°`)
    console.log()
  } else {
    console.log(`❌ ${planet}: NOT CALCULATED`)
    console.log()
  }
}

console.log('='.repeat(80))

// Cleanup
swissEphemerisService.close()
