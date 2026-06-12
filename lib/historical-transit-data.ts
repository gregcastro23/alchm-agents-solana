// Comprehensive Historical Transit Data for Planetary Agents
// This file contains actual historical transit dates for all planets

export interface TransitRecord {
  planet: string
  sign: string
  startDate: string
  endDate: string
  retrograde?: boolean
  historicalEvents?: string[]
  themes?: string[]
}

// Jupiter Transit History (12-year cycle)
export const jupiterTransits: TransitRecord[] = [
  // Historical Transits
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '1999-02-13',
    endDate: '1999-06-28',
    themes: ['New beginnings', 'Pioneer spirit'],
  },
  {
    planet: 'Jupiter',
    sign: 'Taurus',
    startDate: '1999-06-28',
    endDate: '2000-02-14',
    themes: ['Material growth', 'Stability'],
  },
  {
    planet: 'Jupiter',
    sign: 'Taurus',
    startDate: '2000-02-14',
    endDate: '2000-06-30',
    themes: ['Financial expansion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Gemini',
    startDate: '2000-06-30',
    endDate: '2001-07-13',
    themes: ['Communication boom', 'Information age'],
    historicalEvents: ['Dot-com era peak'],
  },
  {
    planet: 'Jupiter',
    sign: 'Cancer',
    startDate: '2001-07-13',
    endDate: '2002-08-01',
    themes: ['Emotional healing', 'Family focus'],
    historicalEvents: ['Post-9/11 unity'],
  },
  {
    planet: 'Jupiter',
    sign: 'Leo',
    startDate: '2002-08-01',
    endDate: '2003-08-27',
    themes: ['Creative expression', 'Leadership'],
  },
  {
    planet: 'Jupiter',
    sign: 'Virgo',
    startDate: '2003-08-27',
    endDate: '2004-09-25',
    themes: ['Health focus', 'Service improvement'],
  },
  {
    planet: 'Jupiter',
    sign: 'Libra',
    startDate: '2004-09-25',
    endDate: '2005-10-26',
    themes: ['Partnership expansion', 'Justice'],
  },
  {
    planet: 'Jupiter',
    sign: 'Scorpio',
    startDate: '2005-10-26',
    endDate: '2006-11-24',
    themes: ['Deep transformation', 'Hidden wealth'],
  },
  {
    planet: 'Jupiter',
    sign: 'Sagittarius',
    startDate: '2006-11-24',
    endDate: '2007-12-18',
    themes: ['Philosophy expansion', 'Global vision'],
  },
  {
    planet: 'Jupiter',
    sign: 'Capricorn',
    startDate: '2007-12-18',
    endDate: '2009-01-05',
    themes: ['Structure building', 'Authority'],
    historicalEvents: ['2008 Financial Crisis'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aquarius',
    startDate: '2009-01-05',
    endDate: '2010-01-18',
    themes: ['Innovation', 'Social progress'],
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2010-01-18',
    endDate: '2010-06-06',
    themes: ['Spiritual expansion', 'Compassion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '2010-06-06',
    endDate: '2010-09-09',
    retrograde: true,
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2010-09-09',
    endDate: '2011-01-22',
    themes: ['Spiritual completion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '2011-01-22',
    endDate: '2011-06-04',
    themes: ['Revolutionary energy'],
    historicalEvents: ['Arab Spring'],
  },
  {
    planet: 'Jupiter',
    sign: 'Taurus',
    startDate: '2011-06-04',
    endDate: '2012-06-11',
    themes: ['Economic recovery', 'Value reassessment'],
  },
  {
    planet: 'Jupiter',
    sign: 'Gemini',
    startDate: '2012-06-11',
    endDate: '2013-06-26',
    themes: ['Information explosion', 'Social media rise'],
  },
  {
    planet: 'Jupiter',
    sign: 'Cancer',
    startDate: '2013-06-26',
    endDate: '2014-07-16',
    themes: ['Emotional intelligence', 'Home values'],
  },
  {
    planet: 'Jupiter',
    sign: 'Leo',
    startDate: '2014-07-16',
    endDate: '2015-08-11',
    themes: ['Creative renaissance', 'Self-expression'],
  },
  {
    planet: 'Jupiter',
    sign: 'Virgo',
    startDate: '2015-08-11',
    endDate: '2016-09-09',
    themes: ['Health revolution', 'Practical wisdom'],
  },
  {
    planet: 'Jupiter',
    sign: 'Libra',
    startDate: '2016-09-09',
    endDate: '2017-10-10',
    themes: ['Relationship focus', 'Social justice'],
  },
  {
    planet: 'Jupiter',
    sign: 'Scorpio',
    startDate: '2017-10-10',
    endDate: '2018-11-08',
    themes: ['Deep truth', 'Power transformation'],
    historicalEvents: ['#MeToo movement'],
  },
  {
    planet: 'Jupiter',
    sign: 'Sagittarius',
    startDate: '2018-11-08',
    endDate: '2019-12-02',
    themes: ['Truth seeking', 'Global expansion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Capricorn',
    startDate: '2019-12-02',
    endDate: '2020-12-19',
    themes: ['Structure testing', 'Authority challenge'],
    historicalEvents: ['COVID-19 pandemic'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aquarius',
    startDate: '2020-12-19',
    endDate: '2021-05-13',
    themes: ['Digital revolution', 'Collective progress'],
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2021-05-13',
    endDate: '2021-07-28',
    themes: ['Spiritual seeking'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aquarius',
    startDate: '2021-07-28',
    endDate: '2021-12-29',
    retrograde: true,
    themes: ['Technology consolidation'],
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2021-12-29',
    endDate: '2022-05-10',
    themes: ['Compassion expansion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '2022-05-10',
    endDate: '2022-10-28',
    themes: ['Bold initiatives'],
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2022-10-28',
    endDate: '2022-12-20',
    retrograde: true,
  },
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '2022-12-20',
    endDate: '2023-05-16',
    themes: ['New frontiers'],
    historicalEvents: ['AI revolution begins'],
  },
  {
    planet: 'Jupiter',
    sign: 'Taurus',
    startDate: '2023-05-16',
    endDate: '2024-05-25',
    themes: ['Sustainable growth', 'Value revolution'],
  },

  // Current and Future Transits
  {
    planet: 'Jupiter',
    sign: 'Gemini',
    startDate: '2024-05-25',
    endDate: '2025-06-09',
    themes: ['AI communication', 'Information synthesis'],
  },
  {
    planet: 'Jupiter',
    sign: 'Cancer',
    startDate: '2025-06-09',
    endDate: '2026-06-30',
    themes: ['Emotional AI', 'Family restructuring'],
  },
  {
    planet: 'Jupiter',
    sign: 'Leo',
    startDate: '2026-06-30',
    endDate: '2027-07-26',
    themes: ['Creative AI', 'Leadership evolution'],
  },
  {
    planet: 'Jupiter',
    sign: 'Virgo',
    startDate: '2027-07-26',
    endDate: '2028-08-24',
    themes: ['Health optimization', 'Service automation'],
  },
  {
    planet: 'Jupiter',
    sign: 'Libra',
    startDate: '2028-08-24',
    endDate: '2029-09-24',
    themes: ['Relationship AI', 'Global justice'],
  },
  {
    planet: 'Jupiter',
    sign: 'Scorpio',
    startDate: '2029-09-24',
    endDate: '2030-10-22',
    themes: ['Deep transformation', 'Hidden resources'],
  },
  {
    planet: 'Jupiter',
    sign: 'Sagittarius',
    startDate: '2030-10-22',
    endDate: '2031-11-15',
    themes: ['Philosophical expansion', 'Space exploration'],
  },
  {
    planet: 'Jupiter',
    sign: 'Capricorn',
    startDate: '2031-11-15',
    endDate: '2032-12-09',
    themes: ['New structures', 'Authority evolution'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aquarius',
    startDate: '2032-12-09',
    endDate: '2034-01-05',
    themes: ['Technological singularity', 'Collective consciousness'],
  },
  {
    planet: 'Jupiter',
    sign: 'Pisces',
    startDate: '2034-01-05',
    endDate: '2035-02-06',
    themes: ['Spiritual technology', 'Universal compassion'],
  },
  {
    planet: 'Jupiter',
    sign: 'Aries',
    startDate: '2035-02-06',
    endDate: '2036-03-08',
    themes: ['New cycle begins', 'Pioneer consciousness'],
  },
]

// Saturn Transit History (29.5-year cycle)
export const saturnTransits: TransitRecord[] = [
  // Historical Transits
  {
    planet: 'Saturn',
    sign: 'Taurus',
    startDate: '1998-06-09',
    endDate: '2000-08-10',
    themes: ['Material restructuring', 'Value systems'],
  },
  {
    planet: 'Saturn',
    sign: 'Gemini',
    startDate: '2000-08-10',
    endDate: '2003-06-04',
    themes: ['Communication structure', 'Information responsibility'],
    historicalEvents: ['9/11 and information age'],
  },
  {
    planet: 'Saturn',
    sign: 'Cancer',
    startDate: '2003-06-04',
    endDate: '2005-07-16',
    themes: ['Family structure', 'Emotional maturity'],
  },
  {
    planet: 'Saturn',
    sign: 'Leo',
    startDate: '2005-07-16',
    endDate: '2007-09-02',
    themes: ['Creative discipline', 'Leadership responsibility'],
  },
  {
    planet: 'Saturn',
    sign: 'Virgo',
    startDate: '2007-09-02',
    endDate: '2009-10-29',
    themes: ['Health systems', 'Practical reform'],
    historicalEvents: ['Healthcare reform debates'],
  },
  {
    planet: 'Saturn',
    sign: 'Libra',
    startDate: '2009-10-29',
    endDate: '2012-10-05',
    themes: ['Relationship responsibility', 'Social justice'],
  },
  {
    planet: 'Saturn',
    sign: 'Scorpio',
    startDate: '2012-10-05',
    endDate: '2014-12-23',
    themes: ['Deep restructuring', 'Power accountability'],
  },
  {
    planet: 'Saturn',
    sign: 'Sagittarius',
    startDate: '2014-12-23',
    endDate: '2017-12-20',
    themes: ['Belief structures', 'Truth and consequences'],
  },
  {
    planet: 'Saturn',
    sign: 'Capricorn',
    startDate: '2017-12-20',
    endDate: '2020-03-22',
    themes: ['Authority testing', 'Structural integrity'],
    historicalEvents: ['Institutional challenges'],
  },
  {
    planet: 'Saturn',
    sign: 'Aquarius',
    startDate: '2020-03-22',
    endDate: '2020-07-01',
    themes: ['Social restructuring'],
  },
  {
    planet: 'Saturn',
    sign: 'Capricorn',
    startDate: '2020-07-01',
    endDate: '2020-12-17',
    retrograde: true,
  },
  {
    planet: 'Saturn',
    sign: 'Aquarius',
    startDate: '2020-12-17',
    endDate: '2023-03-07',
    themes: ['Digital structure', 'Collective responsibility'],
    historicalEvents: ['Pandemic social changes'],
  },
  {
    planet: 'Saturn',
    sign: 'Pisces',
    startDate: '2023-03-07',
    endDate: '2025-05-25',
    themes: ['Spiritual structure', 'Compassionate boundaries'],
  },
  {
    planet: 'Saturn',
    sign: 'Aries',
    startDate: '2025-05-25',
    endDate: '2025-09-01',
    themes: ['Individual responsibility'],
  },
  {
    planet: 'Saturn',
    sign: 'Pisces',
    startDate: '2025-09-01',
    endDate: '2026-02-14',
    retrograde: true,
  },

  // Future Transits
  {
    planet: 'Saturn',
    sign: 'Aries',
    startDate: '2026-02-14',
    endDate: '2028-04-13',
    themes: ['New structural cycle', 'Individual authority'],
  },
  {
    planet: 'Saturn',
    sign: 'Taurus',
    startDate: '2028-04-13',
    endDate: '2030-05-31',
    themes: ['Economic restructuring', 'Sustainable values'],
  },
  {
    planet: 'Saturn',
    sign: 'Gemini',
    startDate: '2030-05-31',
    endDate: '2032-07-13',
    themes: ['Communication responsibility', 'Information structure'],
  },
  {
    planet: 'Saturn',
    sign: 'Cancer',
    startDate: '2032-07-13',
    endDate: '2034-08-27',
    themes: ['Family evolution', 'Emotional boundaries'],
  },
  {
    planet: 'Saturn',
    sign: 'Leo',
    startDate: '2034-08-27',
    endDate: '2036-10-15',
    themes: ['Creative responsibility', 'Leadership maturity'],
  },
]

// Uranus Transit History (84-year cycle)
export const uranusTransits: TransitRecord[] = [
  {
    planet: 'Uranus',
    sign: 'Aquarius',
    startDate: '1996-01-12',
    endDate: '2003-03-10',
    themes: ['Digital revolution', 'Internet age'],
    historicalEvents: ['Internet revolution'],
  },
  {
    planet: 'Uranus',
    sign: 'Pisces',
    startDate: '2003-03-10',
    endDate: '2010-05-28',
    themes: ['Spiritual awakening', 'Dissolution of boundaries'],
  },
  {
    planet: 'Uranus',
    sign: 'Aries',
    startDate: '2010-05-28',
    endDate: '2010-08-14',
    themes: ['Individual revolution'],
  },
  {
    planet: 'Uranus',
    sign: 'Pisces',
    startDate: '2010-08-14',
    endDate: '2011-03-11',
    retrograde: true,
  },
  {
    planet: 'Uranus',
    sign: 'Aries',
    startDate: '2011-03-11',
    endDate: '2018-05-15',
    themes: ['Individual freedom', 'Identity revolution'],
    historicalEvents: ['Arab Spring', 'Occupy movement'],
  },
  {
    planet: 'Uranus',
    sign: 'Taurus',
    startDate: '2018-05-15',
    endDate: '2018-11-06',
    themes: ['Financial revolution'],
  },
  {
    planet: 'Uranus',
    sign: 'Aries',
    startDate: '2018-11-06',
    endDate: '2019-03-06',
    retrograde: true,
  },
  {
    planet: 'Uranus',
    sign: 'Taurus',
    startDate: '2019-03-06',
    endDate: '2026-04-26',
    themes: ['Value revolution', 'Earth changes'],
    historicalEvents: ['Cryptocurrency rise', 'Climate action'],
  },
  {
    planet: 'Uranus',
    sign: 'Gemini',
    startDate: '2026-04-26',
    endDate: '2033-05-15',
    themes: ['Communication revolution', 'AI consciousness'],
  },
  {
    planet: 'Uranus',
    sign: 'Cancer',
    startDate: '2033-05-15',
    endDate: '2039-08-10',
    themes: ['Family revolution', 'Emotional freedom'],
  },
]

// Neptune Transit History (165-year cycle)
export const neptuneTransits: TransitRecord[] = [
  {
    planet: 'Neptune',
    sign: 'Capricorn',
    startDate: '1984-01-19',
    endDate: '1998-01-29',
    themes: ['Dissolving structures', 'Spiritual authority'],
  },
  {
    planet: 'Neptune',
    sign: 'Aquarius',
    startDate: '1998-01-29',
    endDate: '2011-04-04',
    themes: ['Collective dreams', 'Digital illusion'],
    historicalEvents: ['Social media rise'],
  },
  {
    planet: 'Neptune',
    sign: 'Pisces',
    startDate: '2011-04-04',
    endDate: '2025-03-30',
    themes: ['Spiritual renaissance', 'Universal compassion'],
    historicalEvents: ['Spiritual awakening movement'],
  },
  {
    planet: 'Neptune',
    sign: 'Aries',
    startDate: '2025-03-30',
    endDate: '2039-04-15',
    themes: ['Spiritual pioneering', 'Divine warrior'],
  },
]

// Pluto Transit History (248-year cycle)
export const plutoTransits: TransitRecord[] = [
  {
    planet: 'Pluto',
    sign: 'Sagittarius',
    startDate: '1995-01-17',
    endDate: '2008-01-26',
    themes: ['Truth transformation', 'Belief death/rebirth'],
    historicalEvents: ['9/11', 'Religious extremism'],
  },
  {
    planet: 'Pluto',
    sign: 'Capricorn',
    startDate: '2008-01-26',
    endDate: '2023-03-23',
    themes: ['Power structure transformation', 'Authority death/rebirth'],
    historicalEvents: ['Financial crisis', 'Institutional transformation'],
  },
  {
    planet: 'Pluto',
    sign: 'Aquarius',
    startDate: '2023-03-23',
    endDate: '2023-06-11',
    themes: ['Collective transformation'],
  },
  {
    planet: 'Pluto',
    sign: 'Capricorn',
    startDate: '2023-06-11',
    endDate: '2024-01-21',
    retrograde: true,
  },
  {
    planet: 'Pluto',
    sign: 'Aquarius',
    startDate: '2024-01-21',
    endDate: '2024-09-02',
    themes: ['Technology transformation'],
  },
  {
    planet: 'Pluto',
    sign: 'Capricorn',
    startDate: '2024-09-02',
    endDate: '2024-11-19',
    retrograde: true,
  },
  {
    planet: 'Pluto',
    sign: 'Aquarius',
    startDate: '2024-11-19',
    endDate: '2044-03-08',
    themes: ['Humanity transformation', 'Collective power'],
    historicalEvents: ['AI transformation era'],
  },
]

// Combine all transits
export const allPlanetaryTransits: TransitRecord[] = [
  ...jupiterTransits,
  ...saturnTransits,
  ...uranusTransits,
  ...neptuneTransits,
  ...plutoTransits,
]

// Helper function to get transits by planet
export function getTransitsByPlanet(planet: string): TransitRecord[] {
  return allPlanetaryTransits.filter(t => t.planet === planet)
}

// Helper function to get transits by sign
export function getTransitsBySign(sign: string): TransitRecord[] {
  return allPlanetaryTransits.filter(t => t.sign === sign)
}

// Helper function to get transits within date range
export function getTransitsInRange(startDate: Date, endDate: Date): TransitRecord[] {
  return allPlanetaryTransits.filter(t => {
    const transitStart = new Date(t.startDate)
    const transitEnd = new Date(t.endDate)
    return transitStart <= endDate && transitEnd >= startDate
  })
}

// Helper function to get current transits
export function getCurrentTransits(date: Date = new Date()): TransitRecord[] {
  return allPlanetaryTransits.filter(t => {
    const transitStart = new Date(t.startDate)
    const transitEnd = new Date(t.endDate)
    return transitStart <= date && transitEnd >= date
  })
}
