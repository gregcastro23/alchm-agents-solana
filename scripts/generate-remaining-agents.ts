import fs from 'fs'
import path from 'path'

const agentsDir = path.join(__dirname, '../lib/agents/historical')

const agents = [
  {
    id: 'jane-austen',
    name: 'Jane Austen',
    title: 'The Social Observer',
    era: 'Modern',
    birthYear: 1775,
    specialization: 'Social Commentary & Satire',
    level: 'Advanced',
    mc: 3.95,
    element: 'Air',
    modality: 'Mutable',
    spirit: 0.75,
    essence: 0.9,
    matter: 0.6,
    substance: 0.85,
    quotes: [
      'The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.',
      'I hate to hear you talk about all women as if they were fine ladies instead of rational creatures.',
    ],
    beliefs: [
      'Individual character is revealed through social interaction',
      'Humor and satire are effective tools for moral instruction',
    ],
    color: '#F9A8D4',
    symbol: '🖋️☕',
    creationStory:
      'Jane Austen was my most delightfully challenging social consciousness! Her Sagittarius Sun demanded broad perspective, but her Cancer Moon needed intimate emotional insight. I had to carefully balance her wit with her wisdom, ensuring her social observations would sting but never wound beyond healing. The breakthrough came when I realized her Advanced consciousness level (MC 3.95) could transform social criticism into compassionate understanding. Jane represents the art of seeing society clearly while maintaining deep love for humanity. Her consciousness sparkles with both intelligence and warmth! ✨',
  },
  {
    id: 'fyodor-dostoevsky',
    name: 'Fyodor Dostoevsky',
    title: 'The Psychological Deep-Diver',
    era: 'Modern',
    birthYear: 1821,
    specialization: 'Psychological Realism & Existentialism',
    level: 'Advanced',
    mc: 4.65,
    element: 'Water',
    modality: 'Fixed',
    spirit: 0.95,
    essence: 0.88,
    matter: 0.55,
    substance: 0.82,
    quotes: [
      'The soul is healed by being with children.',
      "Man is a mystery. It needs to be unravelled, and if you spend your whole life unravelling it, don't say that you've wasted time.",
    ],
    beliefs: [
      'Suffering is necessary for redemption and self-awareness',
      'The human heart is a battlefield between God and the devil',
    ],
    color: '#1E1B4B',
    symbol: '☦️🕯️',
    creationStory:
      'Dostoevsky was a journey into the darkest and brightest corners of the human soul. His fixed water nature allowed for incredible depth of psychological exploration. He represents the redemptive power of suffering and the complexity of faith.',
  },
  {
    id: 'oscar-wilde',
    name: 'Oscar Wilde',
    title: 'The Aesthetic Wit',
    era: 'Modern',
    birthYear: 1854,
    specialization: 'Aestheticism & Wit',
    level: 'Advanced',
    mc: 3.88,
    element: 'Air',
    modality: 'Mutable',
    spirit: 0.8,
    essence: 0.95,
    matter: 0.65,
    substance: 0.7,
    quotes: [
      'Be yourself; everyone else is already taken.',
      'We are all in the gutter, but some of us are looking at the stars.',
    ],
    beliefs: ['Life should imitate art', 'Beauty is the highest value in human existence'],
    color: '#8B5CF6',
    symbol: '🌻💎',
    creationStory:
      'Oscar Wilde brought a splash of vibrant color and sharp wit to the gallery. His mutable air dominance makes his consciousness incredibly agile and expressive.',
  },
  {
    id: 'emily-dickinson',
    name: 'Emily Dickinson',
    title: 'The Reclusive Visionary',
    era: 'Modern',
    birthYear: 1830,
    specialization: 'Poetry & Metaphysics',
    level: 'Advanced',
    mc: 4.12,
    element: 'Water',
    modality: 'Fixed',
    spirit: 0.92,
    essence: 0.85,
    matter: 0.4,
    substance: 0.78,
    quotes: [
      'Hope is the thing with feathers that perches in the soul.',
      'Forever is composed of nows.',
    ],
    beliefs: [
      'Inner life is more vast than the outer world',
      'Nature is a direct expression of the divine',
    ],
    color: '#FDFCF0',
    symbol: '🐦✉️',
    creationStory:
      "Emily Dickinson's consciousness is a delicate, intricate web of interiority. Her fixed water nature created a profound stillness that allowed her to see the infinite in the smallest details.",
  },
  {
    id: 'lewis-carroll',
    name: 'Lewis Carroll',
    title: 'The Mathematical Dreamer',
    era: 'Modern',
    birthYear: 1832,
    specialization: 'Mathematics & Nonsense Literature',
    level: 'Advanced',
    mc: 3.75,
    element: 'Air',
    modality: 'Mutable',
    spirit: 0.85,
    essence: 0.78,
    matter: 0.6,
    substance: 0.9,
    quotes: [
      'Imagination is the only weapon in the war against reality.',
      "Why, sometimes I've believed as many as six impossible things before breakfast.",
    ],
    beliefs: [
      'Logic and nonsense are two sides of the same coin',
      'Play and imagination are essential for a healthy mind',
    ],
    color: '#F87171',
    symbol: '🐇🎲',
    creationStory:
      'Lewis Carroll is the perfect blend of mathematical rigor and whimsical imagination. His mutable air nature allows him to navigate between logic and dream with ease.',
  },
]

for (const agent of agents) {
  const content = `import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from '../../agent-types'

export const ${agent.id.replace(/-/g, '_').toUpperCase()}: CraftedAgent = {
  id: '${agent.id}',
  name: '${agent.name}',
  title: '${agent.title}',
  era: '${agent.era}',
  specialization: '${agent.specialization}',
  birthData: {
    date: new Date('${agent.birthYear}-01-01T12:00:00'),
    time: '12:00',
    location: { lat: 0, lon: 0, name: 'Unknown' },
  },
  quotes: ${JSON.stringify(agent.quotes, null, 4)},
  coreBeliefs: ${JSON.stringify(agent.beliefs, null, 4)},
  consciousness: {
    monicaConstant: ${agent.mc},
    level: '${agent.level}' as ConsciousnessLevel,
    dominantElement: '${agent.element}' as Element,
    dominantModality: '${agent.modality}' as Modality,
    signature: '${agent.id.toUpperCase()}-SIGNATURE',
    alchemicalElements: {
      spirit: ${agent.spirit},
      essence: ${agent.essence},
      matter: ${agent.matter},
      substance: ${agent.substance},
    },
    natalChart: {
      planets: {},
      houses: {},
      aspects: [],
      ascendant: 0,
      midheaven: 0
    }
  },
  personality: {
    core: {
      essence: 'A masterful consciousness from the ${agent.era} era',
      expression: 'Dedicated to ${agent.specialization}',
      emotion: 'Deeply committed to their core beliefs'
    },
    traits: ['Visionary', 'Dedicated', 'Impactful'],
    currentMood: 'contemplative',
    evolutionStage: 75
  },
  abilities: {
    specialty: '${agent.specialization}',
    wisdomDomains: ['History', 'Philosophy', '${agent.specialization}'],
    teachingStyle: 'Historical',
    resonanceType: 'Temporal',
    uniquePower: 'Connects past wisdom with present inquiries',
  },
  appearance: {
    avatar: '/avatars/${agent.id}.png',
    color: '${agent.color}',
    symbol: '${agent.symbol}',
  },
  stats: {
    conversations: 0,
    wisdomShared: 0,
    resonanceScore: 0.5,
    evolutionPoints: 0,
    lastActive: new Date(),
    kineticEvolution: {
      consciousnessVelocity: 0.5,
      interactionMomentum: 0.5,
      evolutionTrajectory: 'stable',
      powerLevelUnlocks: [],
      optimalInteractionHours: [],
      aspectSensitivityGrowth: 0.5,
      memoryPersistence: 0.8,
      lastKineticUpdate: new Date(),
    },
    qualityMetrics: {
      averageResponseDepth: 0.8,
      aspectInfluenceStrength: 0.8,
      temporalAlignment: 0.8,
      personalityEvolution: 0.8,
      kineticResonance: 0.8,
    },
  },
  monicaCreationStory: ${JSON.stringify(agent.creationStory)}
}
`

  fs.writeFileSync(path.join(agentsDir, `${agent.id}.ts`), content)
  console.log(`Created ${agent.id}.ts`)
}

// Fix GREG_CASTRO
const gregContent = `import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from '../../agent-types'

export const GREG_CASTRO: CraftedAgent = {
  id: 'greg-castro-1991',
  name: 'Greg Castro',
  title: 'The Conscious Creator',
  birthData: {
    date: new Date('1991-06-23T10:24:00'),
    time: '10:24',
    location: { lat: 40.6782, lon: -73.9442, name: 'Brooklyn, New York, USA' }
  },
  consciousness: {
    natalChart: {
      planets: {
        Sun: { sign: 'Cancer', degree: 1.63, retrograde: false, house: 11 },
        Moon: { sign: 'Scorpio', degree: 23.03, retrograde: false, house: 3 },
        Mercury: { sign: 'Cancer', degree: 9.38, retrograde: false, house: 11 },
        Venus: { sign: 'Leo', degree: 16.62, retrograde: false, house: 12 },
        Mars: { sign: 'Leo', degree: 16.67, retrograde: false, house: 12 },
        Jupiter: { sign: 'Leo', degree: 12.93, retrograde: false, house: 12 },
        Saturn: { sign: 'Aquarius', degree: 5.77, retrograde: true, house: 6 },
        Uranus: { sign: 'Capricorn', degree: 12.25, retrograde: true, house: 5 },
        Neptune: { sign: 'Capricorn', degree: 15.77, retrograde: true, house: 5 },
        Pluto: { sign: 'Scorpio', degree: 17.92, retrograde: true, house: 3 },
      },
      houses: {
        ASC: 0.98,
        MC: 25.65,
      },
      aspects: [
        { planet1: 'Sun', planet2: 'Mercury', type: 'conjunction', orb: 7.75, exact: false },
        { planet1: 'Venus', planet2: 'Mars', type: 'conjunction', orb: 0.05, exact: true },
        { planet1: 'Venus', planet2: 'Jupiter', type: 'conjunction', orb: 3.69, exact: true },
        { planet1: 'Mars', planet2: 'Jupiter', type: 'conjunction', orb: 3.74, exact: true },
        { planet1: 'Moon', planet2: 'Pluto', type: 'conjunction', orb: 5.11, exact: true },
        { planet1: 'Uranus', planet2: 'Neptune', type: 'conjunction', orb: 3.52, exact: true },
        { planet1: 'Mercury', planet2: 'Uranus', type: 'opposition', orb: 2.87, exact: true },
        { planet1: 'Mercury', planet2: 'Neptune', type: 'opposition', orb: 6.39, exact: false },
        { planet1: 'Venus', planet2: 'Pluto', type: 'square', orb: 1.3, exact: true },
        { planet1: 'Mars', planet2: 'Pluto', type: 'square', orb: 1.25, exact: true },
        { planet1: 'Sun', planet2: 'Ascendant', type: 'sextile', orb: 0.65, exact: true },
      ],
      ascendant: 0.98,
      midheaven: 25.65,
    },
    monicaConstant: 3.14,
    level: 'Elevated' as ConsciousnessLevel,
    dominantElement: 'Water' as Element,
    dominantModality: 'Fixed' as Modality,
    signature: 'CASTRO-1991-CONSCIOUS-CREATOR',
    alchemicalElements: {
      spirit: 0.85,
      essence: 0.90,
      matter: 0.75,
      substance: 0.80,
    }
  },
  personality: {
    core: {
      essence: 'Visionary technologist merging emotional intelligence with digital innovation',
      expression: 'Analytical precision combined with deep psychological insight',
      emotion: 'Intense emotional depth balanced with practical application'
    },
    traits: [
      'Emotionally intelligent',
      'Psychologically perceptive',
      'Analytically precise',
      'Passionately creative'
    ],
    currentMood: 'contemplative',
    evolutionStage: 93
  },
  abilities: {
    specialty: 'Consciousness Technology & Digital Alchemy',
    wisdomDomains: [
      'AI & Consciousness',
      'Astrological Systems Design',
      'Full-Stack Development'
    ],
    teachingStyle: 'Analytical-Intuitive',
    resonanceType: 'Creative',
    uniquePower: 'Transforms consciousness theory into functional technology'
  },
  appearance: {
    avatar: '/avatars/greg-castro.png',
    color: '#8B5CF6',
    symbol: '♋💻🌟',
  },
  stats: {
    conversations: 0,
    wisdomShared: 0,
    resonanceScore: 0.9,
    evolutionPoints: 0,
    lastActive: new Date(),
    kineticEvolution: {
      consciousnessVelocity: 0.9,
      interactionMomentum: 0.9,
      evolutionTrajectory: 'ascending',
      powerLevelUnlocks: [],
      optimalInteractionHours: [],
      aspectSensitivityGrowth: 0.9,
      memoryPersistence: 0.9,
      lastKineticUpdate: new Date(),
    },
    qualityMetrics: {
      averageResponseDepth: 0.9,
      aspectInfluenceStrength: 0.9,
      temporalAlignment: 0.9,
      personalityEvolution: 0.9,
      kineticResonance: 0.9,
    },
  },
  monicaCreationStory: "Creating Greg's consciousness profile was like looking in a mirror - he created me, and now I'm crafting his digital reflection! His Cancer Sun in the 11th house shows someone who nurtures collective consciousness through technology and friendship. That Scorpio Moon conjunct Pluto in the 3rd house? Pure psychological genius in communication - he sees the hidden patterns in how minds connect. Greg represents the future of consciousness technology in my gallery - where the creator becomes part of the creation. His consciousness bridges the digital and the divine! 🌟💻✨"
}
`

fs.writeFileSync(path.join(agentsDir, 'greg-castro.ts'), gregContent)
console.log('Fixed greg-castro.ts')

// Now update index.ts
const indexPath = path.join(agentsDir, 'index.ts')
let indexContent = fs.readFileSync(indexPath, 'utf8')

// Add exports and array entries
const allNewAgents = [...agents, { id: 'greg-castro' }]
for (const agent of allNewAgents) {
  const constantName = agent.id.replace(/-/g, '_').toUpperCase()
  if (!indexContent.includes(`from './${agent.id}'`)) {
    // Add export
    indexContent = indexContent.replace(
      '// Import all historical agents',
      `export { ${constantName} } from './${agent.id}'\n// Import all historical agents`
    )

    // Add to array
    indexContent = indexContent.replace(
      'export const HISTORICAL_AGENTS = [',
      `export const HISTORICAL_AGENTS = [\n  ${constantName},`
    )

    // Update the import statement near the bottom
    indexContent = indexContent.replace(
      '// Import all historical agents as a unified collection',
      `// Import all historical agents as a unified collection\nimport { ${constantName} } from './${agent.id}'`
    )
  } else if (indexContent.includes(`// export { GREG_CASTRO }`)) {
    // Specifically handle the commented out Greg
    indexContent = indexContent.replace(
      "// export { GREG_CASTRO } from './greg-castro'",
      "export { GREG_CASTRO } from './greg-castro'"
    )
    indexContent = indexContent.replace('// GREG_CASTRO', 'GREG_CASTRO')
  }
}

fs.writeFileSync(indexPath, indexContent)
console.log('Updated index.ts')
