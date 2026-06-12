/**
 * Generate Natal Charts for Agents Missing Them
 *
 * This script will generate natal chart data for all agents
 * that are missing sun/moon positions.
 */

import { DEMO_AGENTS } from '../lib/demo-agents-data'

// Known birth data for historical figures
const BIRTH_DATA: Record<string, { date: string; location?: string }> = {
  // Existing agents
  'carl-jung': { date: '1875-07-26', location: 'Switzerland' },
  'nikola-tesla': { date: '1856-07-10', location: 'Croatia' },
  cleopatra: { date: '-0069-01-01', location: 'Egypt' }, // Approximate
  'frida-kahlo': { date: '1907-07-06', location: 'Mexico' },
  'leonardo-da-vinci': { date: '1452-04-15', location: 'Italy' },
  'marie-curie': { date: '1867-11-07', location: 'Poland' },
  socrates: { date: '-0470-01-01', location: 'Greece' }, // Approximate
  rumi: { date: '1207-09-30', location: 'Afghanistan' },
  'marcus-aurelius': { date: '0121-04-26', location: 'Rome' },
  'vincent-van-gogh': { date: '1853-03-30', location: 'Netherlands' },
  'wolfgang-mozart': { date: '1756-01-27', location: 'Austria' },
  'william-shakespeare': { date: '1564-04-23', location: 'England' },
  'maya-angelou': { date: '1928-04-04', location: 'USA' },
  'isaac-newton': { date: '1643-01-04', location: 'England' },
  'charles-darwin': { date: '1809-02-12', location: 'England' },
  'galileo-galilei': { date: '1564-02-15', location: 'Italy' },

  // Enlightenment era agents
  'rene-descartes-1596': { date: '1596-03-31', location: 'France' },
  'voltaire-1694': { date: '1694-11-21', location: 'France' },
  'john-locke-1632': { date: '1632-08-29', location: 'England' },
  'david-hume-1711': { date: '1711-05-07', location: 'Scotland' },
  'johannes-kepler-1571': { date: '1571-12-27', location: 'Germany' },
  'immanuel-kant-1724': { date: '1724-04-22', location: 'Germany' },
  'adam-smith-1723': { date: '1723-06-16', location: 'Scotland' },
  'jean-jacques-rousseau-1712': { date: '1712-06-28', location: 'Switzerland' },
  'mary-wollstonecraft-1759': { date: '1759-04-27', location: 'England' },
  'charles-dickens-1812': { date: '1812-02-07', location: 'England' },
  'claude-monet-1840': { date: '1840-11-14', location: 'France' },
  'nikola-tesla-1856': { date: '1856-07-10', location: 'Croatia' },
  'marie-curie-1867': { date: '1867-11-07', location: 'Poland' },
  'sigmund-freud-1856': { date: '1856-05-06', location: 'Austria' },
  'mark-twain-1835': { date: '1835-11-30', location: 'USA' },
  'vincent-van-gogh-1853': { date: '1853-03-30', location: 'Netherlands' },
  'charles-darwin-1809': { date: '1809-02-12', location: 'England' },
  'edgar-allan-poe-1809': { date: '1809-01-19', location: 'USA' },
  'isaac-asimov': { date: '1920-01-02', location: 'Russia' },
}

// Zodiac sign calculator
function getZodiacSign(month: number, day: number): string {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini'
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio'
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius'
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius'
  return 'Pisces'
}

// Calculate degree within sign (approximate)
function getDegreeInSign(day: number): number {
  // Rough approximation: 30 degrees / ~30 days
  return Math.floor((day / 30) * 30)
}

// Generate natal chart from birth date
function generateNatalChart(birthDate: string) {
  const [year, month, day] = birthDate.split('-').map(s => {
    // Handle negative years (BC)
    if (s.startsWith('-')) {
      return parseInt(s.slice(1)) * -1
    }
    return parseInt(s)
  })

  const sunSign = getZodiacSign(Math.abs(month), day)
  const sunDegree = getDegreeInSign(day)

  // For moon, offset by ~13 degrees per day from sun
  // This is simplified - real moon moves faster
  const moonOffset = (day * 13) % 360
  const moonSignIndex = Math.floor(moonOffset / 30)
  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]
  const moonSign = signs[moonSignIndex]
  const moonDegree = moonOffset % 30

  // Generate reasonable house placements
  const sunHouse = ((month + day) % 12) + 1
  const moonHouse = ((sunHouse + 4) % 12) + 1

  return {
    sun: { sign: sunSign, degree: sunDegree, house: sunHouse },
    moon: { sign: moonSign, degree: moonDegree, house: moonHouse },
    ascendant: { sign: sunSign, degree: (sunDegree + 15) % 30 }, // Simplified
  }
}

// Main execution
console.log('🌟 Generating Natal Charts for Agents...\n')

const agentsMissingCharts: string[] = []
const chartsGenerated: Array<{ id: string; name: string; chart: any }> = []

for (const agent of DEMO_AGENTS) {
  // Check if agent is missing sun/moon
  const hasSun = agent.consciousness?.natalChart?.sun
  const hasMoon = agent.consciousness?.natalChart?.moon

  if (!hasSun || !hasMoon) {
    agentsMissingCharts.push(agent.id)

    // Try to generate chart
    const birthData = BIRTH_DATA[agent.id]
    if (birthData) {
      const chart = generateNatalChart(birthData.date)
      chartsGenerated.push({
        id: agent.id,
        name: agent.name,
        chart,
      })
      console.log(`✅ Generated chart for ${agent.name} (${agent.id})`)
      console.log(`   Sun: ${chart.sun.sign} ${chart.sun.degree}° (House ${chart.sun.house})`)
      console.log(
        `   Moon: ${chart.moon.sign} ${chart.moon.degree.toFixed(2)}° (House ${chart.moon.house})`
      )
      console.log(`   Ascendant: ${chart.ascendant.sign} ${chart.ascendant.degree.toFixed(2)}°`)
      console.log()
    } else {
      console.log(`⚠️  No birth data for ${agent.name} (${agent.id})`)
    }
  }
}

console.log('\n' + '='.repeat(80))
console.log('SUMMARY')
console.log('='.repeat(80))
console.log(`Total agents missing charts: ${agentsMissingCharts.length}`)
console.log(`Charts generated: ${chartsGenerated.length}`)
console.log(`Still need birth data: ${agentsMissingCharts.length - chartsGenerated.length}`)
console.log('='.repeat(80))

// Export for use in fixing the data file
console.log('\n📝 Generated charts data:')
console.log(JSON.stringify(chartsGenerated, null, 2))
