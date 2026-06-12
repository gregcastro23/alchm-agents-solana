export type Element = 'Fire' | 'Water' | 'Earth' | 'Air'

export interface AlchemicalConstitution {
  spirit: number // Fire
  essence: number // Water
  matter: number // Earth
  substance: number // Air
}

export function calculateAlchemicalBlueprint(
  dateStr: string,
  timeStr: string
): { dominantElement: Element; constitution: AlchemicalConstitution } {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()

  let dominantElement: Element = 'Fire'

  // Determine Zodiac Sign and map to Element
  if (
    (month === 3 && day >= 21) ||
    (month === 4 && day <= 19) ||
    (month === 7 && day >= 23) ||
    (month === 8 && day <= 22) ||
    (month === 11 && day >= 22) ||
    (month === 12 && day <= 21)
  ) {
    dominantElement = 'Fire' // Aries, Leo, Sagittarius
  } else if (
    (month === 6 && day >= 21) ||
    (month === 7 && day <= 22) ||
    (month === 10 && day >= 23) ||
    (month === 11 && day <= 21) ||
    (month === 2 && day >= 19) ||
    (month === 3 && day <= 20)
  ) {
    dominantElement = 'Water' // Cancer, Scorpio, Pisces
  } else if (
    (month === 4 && day >= 20) ||
    (month === 5 && day <= 20) ||
    (month === 8 && day >= 23) ||
    (month === 9 && day <= 22) ||
    (month === 12 && day >= 22) ||
    (month === 1 && day <= 19)
  ) {
    dominantElement = 'Earth' // Taurus, Virgo, Capricorn
  } else if (
    (month === 5 && day >= 21) ||
    (month === 6 && day <= 20) ||
    (month === 9 && day >= 23) ||
    (month === 10 && day <= 22) ||
    (month === 1 && day >= 20) ||
    (month === 2 && day <= 18)
  ) {
    dominantElement = 'Air' // Gemini, Libra, Aquarius
  }

  // Calculate baseline allocations out of 100%
  // Dominant gets 50%, others split remaining 50% based on birth hour (0-23)
  const [hour] = timeStr.split(':').map(Number)

  // Create a pseudo-random but deterministic split based on the hour
  const remainder1 = 15 + (hour % 10)
  const remainder2 = 15 + ((hour * 3) % 10)
  const remainder3 = 50 - remainder1 - remainder2

  const remainders = [remainder1, remainder2, remainder3]

  let spirit = 0,
    essence = 0,
    matter = 0,
    substance = 0

  switch (dominantElement) {
    case 'Fire':
      spirit = 50
      essence = remainders[0]
      matter = remainders[1]
      substance = remainders[2]
      break
    case 'Water':
      essence = 50
      spirit = remainders[0]
      matter = remainders[1]
      substance = remainders[2]
      break
    case 'Earth':
      matter = 50
      spirit = remainders[0]
      essence = remainders[1]
      substance = remainders[2]
      break
    case 'Air':
      substance = 50
      spirit = remainders[0]
      essence = remainders[1]
      matter = remainders[2]
      break
  }

  return {
    dominantElement,
    constitution: { spirit, essence, matter, substance },
  }
}
