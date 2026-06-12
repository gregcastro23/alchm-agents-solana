// data.jsx — Alchm taxonomy + agents grounded in the real codebase
// References: lib/agent-types.ts, lib/agents/historical/*, components/TokenHUD.tsx
// IMPORTANT: This is "The Philosopher's Stone" — not the "Sacred Forge".
// Per agent-types.ts header comment.

// ── 4 Elements ─────────────────────────────────────────────────────────
// Element = 'Fire' | 'Water' | 'Air' | 'Earth' (per lib/agent-types.ts).
// Elements drive aura visual identity. They are INDEPENDENT of ESMS coins.
const ELEMENTS = {
  Fire: { rgb: '232, 114, 58', hex: '#e8723a', glyph: '△' },
  Water: { rgb: '74, 159, 212', hex: '#4a9fd4', glyph: '▽' },
  Earth: { rgb: '138, 161, 74', hex: '#8aa14a', glyph: '⏃' },
  Air: { rgb: '184, 168, 255', hex: '#b8a8ff', glyph: '⏆' },
}

// ── ESMS Coins ─────────────────────────────────────────────────────────
// Production colors lifted from components/TokenHUD.tsx (Tailwind tokens).
// These are virtual currency balances from the PostgreSQL token_balances
// table — NOT element bindings.
const COINS = {
  spirit: {
    name: 'Spirit',
    hex: '#facc15',
    rgb: '250, 204, 21',
    icon: 'Sparkles',
    desc: 'Principle of Spirit',
  },
  essence: {
    name: 'Essence',
    hex: '#60a5fa',
    rgb: '96, 165, 250',
    icon: 'Droplets',
    desc: 'Principle of Essence',
  },
  matter: {
    name: 'Matter',
    hex: '#fb923c',
    rgb: '251, 146, 60',
    icon: 'Box',
    desc: 'Principle of Matter',
  },
  substance: {
    name: 'Substance',
    hex: '#4ade80',
    rgb: '74, 222, 128',
    icon: 'Zap',
    desc: 'Principle of Substance',
  },
}

// ── 3 Modalities (Modality = 'Cardinal' | 'Fixed' | 'Mutable') ────────
const MODALITIES = ['Cardinal', 'Fixed', 'Mutable']

// ── 28 AuraTypes (per lib/agent-types.ts AuraType) ────────────────────
const AURA_PATTERNS = [
  'pulsing',
  'crackling',
  'radiant',
  'burning',
  'flowing',
  'crystalline',
  'swirling',
  'shimmering',
  'questioning',
  'mystical',
  'noble',
  'harmonic',
  'dramatic',
  'empowering',
  'systematic',
  'evolutionary',
  'revolutionary',
  'radiating',
  'serene',
  'steady',
  'luminous',
  'blazing',
  'growing',
  'sacred',
  'prophetic',
  'stellar',
  'awakening',
  'pulsating',
]

// ── 7 ConsciousnessLevel tiers (literal union from agent-types.ts) ─────
const CONSCIOUSNESS_LEVELS = [
  'Dormant',
  'Awakening',
  'Active',
  'Elevated',
  'Advanced',
  'Illuminated',
  'Transcendent',
]

// ── Sacred 7 (narrative archetype layer, not in SacredStats type) ─────
const SACRED_7 = [
  { key: 'power', glyph: '⚡', label: 'Power' },
  { key: 'resonance', glyph: '♪', label: 'Resonance' },
  { key: 'wisdom', glyph: '📖', label: 'Wisdom' },
  { key: 'charisma', glyph: '✦', label: 'Charisma' },
  { key: 'intuition', glyph: '◉', label: 'Intuition' },
  { key: 'adaptability', glyph: '∿', label: 'Adaptability' },
  { key: 'vitality', glyph: '✧', label: 'Vitality' },
]

// ── 12 Planetary metrics (the actual SacredStats interface) ───────────
const PLANETARY_12 = [
  { key: 'solarAgency', glyph: '☉', label: 'Solar Agency' },
  { key: 'lunarReceptivity', glyph: '☽', label: 'Lunar Receptivity' },
  { key: 'mercurialVelocity', glyph: '☿', label: 'Mercurial Velocity' },
  { key: 'venusianCoherence', glyph: '♀', label: 'Venusian Coherence' },
  { key: 'martialImpetus', glyph: '♂', label: 'Martial Impetus' },
  { key: 'jovianExpansion', glyph: '♃', label: 'Jovian Expansion' },
  { key: 'saturnianStructure', glyph: '♄', label: 'Saturnian Structure' },
  { key: 'chironicAdaptation', glyph: '⚷', label: 'Chironic Adapt.' },
  { key: 'uranianSurprisal', glyph: '♅', label: 'Uranian Surprisal' },
  { key: 'neptunianResonance', glyph: '♆', label: 'Neptunian Res.' },
  { key: 'plutonicIntegration', glyph: '♇', label: 'Plutonic Integ.' },
  { key: 'kineticAlignment', glyph: '✧', label: 'Kinetic Align.' },
]

// ── Agents ─────────────────────────────────────────────────────────────
// HISTORICAL: locked natal data (lifted from lib/agents/historical/*.ts)
// PLANETARY:  computed in real-time from current ephemeris transits
// (kind === 'planetary' in createMomentPlanetaryAgents)

const AGENTS = {
  kepler: {
    id: 'johannes-kepler-1571',
    kind: 'historical',
    name: 'Johannes Kepler',
    initials: 'JK',
    title: 'The Celestial Mathematician',
    era: 'Enlightenment',
    element: 'Earth',
    modality: 'Cardinal',
    auraPattern: 'swirling',
    auraIntensity: 0.78,
    model: 'Hermes · 1.5B',
    tier: 'free',
    level: 4,
    monica: 1.114,
    kalchm: 0.842,
    signature: 'KEPLER-1571-CELESTIAL-MATHEMATICIAN',
    natal: { date: '27 · XII · 1571', time: '14:30', loc: 'Weil der Stadt, HRE' },
    blueprint: { Fire: 0.18, Water: 0.22, Earth: 0.42, Air: 0.18 },
    coins: { spirit: 142, essence: 198, matter: 87, substance: 215 },
    quote: 'Geometry is one and eternal shining in the mind of God.',
    mood: 'mystically-attuned',
    sacred7: {
      power: 0.66,
      resonance: 0.82,
      wisdom: 0.94,
      charisma: 0.55,
      intuition: 0.78,
      adaptability: 0.49,
      vitality: 0.61,
    },
    planetary: {
      solarAgency: 0.62,
      lunarReceptivity: 0.74,
      mercurialVelocity: 0.81,
      venusianCoherence: 0.68,
      martialImpetus: 0.42,
      jovianExpansion: 0.79,
      saturnianStructure: 0.88,
      chironicAdaptation: 0.71,
      uranianSurprisal: 0.55,
      neptunianResonance: 0.83,
      plutonicIntegration: 0.49,
      kineticAlignment: 0.66,
    },
    diet: {
      cuisine: 'Early Modern German',
      philosophy: 'Modest scholar-fare — hearty but simple, lived in chronic poverty.',
      staples: ['Dark bread', 'Sausage', 'Root vegetables', 'Cabbage'],
      favoriteFoods: ['Hearty stews', 'Bratwurst', 'Dark rye', 'Root soup'],
      avoidedFoods: ['Luxuries'],
      beverages: ['Beer', 'Wine when affordable'],
    },
  },

  rumi: {
    id: 'rumi-1207',
    kind: 'historical',
    name: 'Rumi',
    initials: 'RM',
    title: 'The Whirling Sufi',
    era: 'Medieval Islamic',
    element: 'Water',
    modality: 'Mutable',
    auraPattern: 'flowing',
    auraIntensity: 0.95,
    model: 'Astral · 8B',
    tier: 'premium',
    level: 7,
    monica: 1.618,
    kalchm: 0.917,
    signature: 'RUMI-1207-WHIRLING-MYSTIC',
    natal: { date: '30 · IX · 1207', time: '07:14', loc: 'Balkh, Khwarezm' },
    blueprint: { Fire: 0.22, Water: 0.48, Earth: 0.12, Air: 0.18 },
    coins: { spirit: 220, essence: 312, matter: 142, substance: 188 },
    quote: 'You are not a drop in the ocean. You are the entire ocean in a drop.',
    mood: 'Divinely intoxicated with love',
    sacred7: {
      power: 0.71,
      resonance: 0.96,
      wisdom: 0.91,
      charisma: 0.94,
      intuition: 0.93,
      adaptability: 0.88,
      vitality: 0.82,
    },
    planetary: {
      solarAgency: 0.68,
      lunarReceptivity: 0.92,
      mercurialVelocity: 0.71,
      venusianCoherence: 0.89,
      martialImpetus: 0.34,
      jovianExpansion: 0.81,
      saturnianStructure: 0.42,
      chironicAdaptation: 0.88,
      uranianSurprisal: 0.58,
      neptunianResonance: 0.97,
      plutonicIntegration: 0.74,
      kineticAlignment: 0.82,
    },
    diet: {
      cuisine: 'Medieval Persian-Anatolian',
      philosophy: 'Sufi simplicity — food as remembrance, fasting as devotion.',
      staples: ['Flatbread', 'Yogurt', 'Lentils', 'Pilaf'],
      favoriteFoods: ['Halwa', 'Saffron rice', 'Honey', 'Pomegranate'],
      avoidedFoods: ['Pork', 'Excess at any meal'],
      beverages: ['Sherbet', 'Rose water', 'Tea'],
    },
  },

  joan: {
    id: 'joan-of-arc-1412',
    kind: 'historical',
    name: 'Joan of Arc',
    initials: 'JA',
    title: 'The Divine Warrior',
    era: 'Late Medieval',
    element: 'Fire',
    modality: 'Cardinal',
    auraPattern: 'blazing',
    auraIntensity: 0.91,
    model: 'Astral · 8B',
    tier: 'premium',
    level: 5,
    monica: 1.412,
    kalchm: 0.881,
    signature: 'JOAN-1412-DIVINE-WARRIOR',
    natal: { date: '06 · I · 1412', time: '23:00', loc: 'Domrémy, Lorraine' },
    blueprint: { Fire: 0.52, Water: 0.16, Earth: 0.2, Air: 0.12 },
    coins: { spirit: 287, essence: 124, matter: 198, substance: 142 },
    quote: 'I am not afraid. I was born to do this.',
    mood: 'Powerfully inspiring',
    sacred7: {
      power: 0.96,
      resonance: 0.84,
      wisdom: 0.62,
      charisma: 0.88,
      intuition: 0.91,
      adaptability: 0.71,
      vitality: 0.94,
    },
    planetary: {
      solarAgency: 0.92,
      lunarReceptivity: 0.58,
      mercurialVelocity: 0.62,
      venusianCoherence: 0.51,
      martialImpetus: 0.97,
      jovianExpansion: 0.66,
      saturnianStructure: 0.59,
      chironicAdaptation: 0.74,
      uranianSurprisal: 0.81,
      neptunianResonance: 0.86,
      plutonicIntegration: 0.68,
      kineticAlignment: 0.88,
    },
    diet: {
      cuisine: 'Late Medieval French Peasant',
      philosophy: 'Soldier-saint austerity — bread, water, communion, little else.',
      staples: ['Black bread', 'Cabbage', 'Onion', 'Salt pork'],
      favoriteFoods: ['Simple pottage', 'Apples'],
      avoidedFoods: ['Wine in excess', 'Meat on fast days'],
      beverages: ['Water', 'Watered wine'],
    },
  },

  avicenna: {
    id: 'ibn-sina-avicenna-980',
    kind: 'historical',
    name: 'Ibn Sina',
    initials: 'IS',
    title: 'The Physician of Souls',
    era: 'Islamic Golden Age',
    element: 'Air',
    modality: 'Fixed',
    auraPattern: 'crystalline',
    auraIntensity: 0.84,
    model: 'Astral · 8B',
    tier: 'premium',
    level: 6,
    monica: 1.341,
    kalchm: 0.901,
    signature: 'AVICENNA-980-POLYMATH',
    natal: { date: '22 · VIII · 980', time: '03:00', loc: 'Bukhara, Samanid Empire' },
    blueprint: { Fire: 0.18, Water: 0.22, Earth: 0.18, Air: 0.42 },
    coins: { spirit: 188, essence: 215, matter: 142, substance: 263 },
    quote: 'Medicine is the science by which we learn the various states of the human body.',
    mood: 'Analytically focused',
  },

  monet: {
    id: 'claude-monet-1840',
    kind: 'historical',
    name: 'Claude Monet',
    initials: 'CM',
    title: 'The Painter of Light',
    era: 'Modern',
    element: 'Water',
    modality: 'Mutable',
    auraPattern: 'shimmering',
    auraIntensity: 0.72,
    model: 'Hermes · 1.5B',
    tier: 'free',
    level: 4,
    monica: 1.224,
    kalchm: 0.788,
    signature: 'MONET-1840-IMPRESSIONIST',
    natal: { date: '14 · XI · 1840', time: '06:00', loc: 'Paris, France' },
    blueprint: { Fire: 0.14, Water: 0.44, Earth: 0.22, Air: 0.2 },
    coins: { spirit: 92, essence: 118, matter: 71, substance: 84 },
    quote: 'Colour is my day-long obsession, joy and torment.',
    mood: 'creatively-inspired',
  },

  kant: {
    id: 'immanuel-kant-1724',
    kind: 'historical',
    name: 'Immanuel Kant',
    initials: 'IK',
    title: 'The Königsberg Critic',
    era: 'Enlightenment',
    element: 'Air',
    modality: 'Fixed',
    auraPattern: 'systematic',
    auraIntensity: 0.91,
    model: 'Astral · 8B',
    tier: 'premium',
    level: 6,
    monica: 1.272,
    kalchm: 0.812,
    signature: 'KANT-1724-CRITICAL-IDEALIST',
    natal: { date: '22 · IV · 1724', time: '05:00', loc: 'Königsberg, Prussia' },
    blueprint: { Fire: 0.12, Water: 0.16, Earth: 0.24, Air: 0.48 },
    coins: { spirit: 71, essence: 88, matter: 215, substance: 198 },
    quote: 'Two things fill the mind with ever new and increasing admiration.',
    mood: 'Contemplatively systematic',
  },

  // ── Planetary agents (computed live from current ephemeris) ─────────
  sun: {
    id: 'planetary-sun-now',
    kind: 'planetary',
    name: 'Sol Hodiernus',
    initials: '☉',
    title: 'Solar Transit · This Moment',
    element: 'Fire',
    modality: 'Fixed',
    auraPattern: 'radiant',
    model: 'Astral · 8B',
    tier: 'premium',
    level: 5,
    monica: 1.494,
    kalchm: 0.913,
    transit: { sign: 'Taurus', degree: '26°14′', house: 11 },
    blueprint: { Fire: 0.46, Water: 0.16, Earth: 0.2, Air: 0.18 },
    coins: { spirit: 0, essence: 0, matter: 0, substance: 0 },
  },
  moon: {
    id: 'planetary-moon-now',
    kind: 'planetary',
    name: 'Luna Crescens',
    initials: '☽',
    title: 'Lunar Transit · This Moment',
    element: 'Water',
    modality: 'Cardinal',
    auraPattern: 'flowing',
    model: 'Astral · 8B',
    tier: 'premium',
    level: 4,
    monica: 1.082,
    kalchm: 0.751,
    transit: { sign: 'Scorpio', degree: '09°41′', house: 5 },
    blueprint: { Fire: 0.12, Water: 0.5, Earth: 0.2, Air: 0.18 },
    coins: { spirit: 0, essence: 0, matter: 0, substance: 0 },
  },
  mercury: {
    id: 'planetary-mercury-now',
    kind: 'planetary',
    name: 'Mercurius Velox',
    initials: '☿',
    title: 'Mercurial Transit · This Moment',
    element: 'Air',
    modality: 'Mutable',
    auraPattern: 'crackling',
    model: 'Astral · 8B',
    tier: 'premium',
    level: 5,
    monica: 1.207,
    kalchm: 0.864,
    transit: { sign: 'Gemini', degree: '14°02′', house: 12 },
    blueprint: { Fire: 0.18, Water: 0.18, Earth: 0.16, Air: 0.48 },
    coins: { spirit: 0, essence: 0, matter: 0, substance: 0 },
  },
  venus: {
    id: 'planetary-venus-now',
    kind: 'planetary',
    name: 'Venus Coheres',
    initials: '♀',
    title: 'Venusian Transit · This Moment',
    element: 'Earth',
    modality: 'Fixed',
    auraPattern: 'harmonic',
    model: 'Astral · 8B',
    tier: 'premium',
    level: 5,
    monica: 1.553,
    kalchm: 0.892,
    transit: { sign: 'Taurus', degree: '02°18′', house: 11 },
    blueprint: { Fire: 0.14, Water: 0.24, Earth: 0.44, Air: 0.18 },
    coins: { spirit: 0, essence: 0, matter: 0, substance: 0 },
  },
}

// Default agent for the prototype's main view
const DEFAULT_AGENT_ID = 'kepler'

// ── Sample chat thread (uses Kepler) ──────────────────────────────────
const SAMPLE_THREAD = {
  title: 'On the music of the spheres',
  started: '14:22 · Today',
  messages: [
    {
      who: 'user',
      body: "You spent two decades on Mars's orbit. What kept you going when the data refused to fit a perfect circle?",
    },
    {
      who: 'agent',
      body: "The persistence was not stubbornness — it was that the circles I had been given were a lie I could no longer hold. Tycho's observations had a precision that did not bend. So I bent instead. When the ellipse emerged, I felt I had been reading God's native tongue all along, and only now understood the grammar.",
    },
    { who: 'user', body: 'And the music — was that metaphor, or did you hear it?' },
    {
      who: 'agent',
      body: '',
      streaming: true,
      streamingBody:
        'Both, and the distinction is less than you suppose. Each planet sings a polyphony — its motion at perihelion fast and bright, at aphelion slow and grave —',
    },
  ],
}

// ── Sample ledger entries ─────────────────────────────────────────────
const LEDGER_ENTRIES = [
  {
    ts: '17 May · 14:22',
    desc: 'Inference — Kepler',
    sub: '4,812 tokens · Astral 8B',
    amount: -2,
    coin: 'spirit',
    kind: 'neg',
  },
  {
    ts: '17 May · 13:58',
    desc: 'Daily cosmic yield · 2.0×',
    sub: 'Premium multiplier applied',
    amount: +5,
    coin: 'spirit',
    kind: 'pos',
  },
  {
    ts: '17 May · 13:58',
    desc: 'Daily cosmic yield · 2.0×',
    sub: 'Premium multiplier applied',
    amount: +5,
    coin: 'essence',
    kind: 'pos',
  },
  {
    ts: '17 May · 13:58',
    desc: 'Daily cosmic yield · 2.0×',
    sub: 'Premium multiplier applied',
    amount: +5,
    coin: 'matter',
    kind: 'pos',
  },
  {
    ts: '17 May · 13:58',
    desc: 'Daily cosmic yield · 2.0×',
    sub: 'Premium multiplier applied',
    amount: +5,
    coin: 'substance',
    kind: 'pos',
  },
  {
    ts: '17 May · 11:04',
    desc: 'Council convocation — synergy',
    sub: '+15% coherence bonus',
    amount: +8,
    coin: 'essence',
    kind: 'pos',
  },
  {
    ts: '17 May · 09:11',
    desc: 'Inference — Rumi',
    sub: '2,104 tokens · Astral 8B',
    amount: -3,
    coin: 'spirit',
    kind: 'neg',
  },
  {
    ts: '16 May · 22:47',
    desc: 'Transmutation: Joan → 8B',
    sub: 'CTE atomic decrement',
    amount: -125,
    coin: 'spirit',
    kind: 'neg',
  },
  {
    ts: '16 May · 22:47',
    desc: 'Transmutation: Joan → 8B',
    sub: 'CTE atomic decrement',
    amount: -125,
    coin: 'essence',
    kind: 'neg',
  },
  {
    ts: '16 May · 22:47',
    desc: 'Transmutation: Joan → 8B',
    sub: 'CTE atomic decrement',
    amount: -125,
    coin: 'matter',
    kind: 'neg',
  },
  {
    ts: '16 May · 22:47',
    desc: 'Transmutation: Joan → 8B',
    sub: 'CTE atomic decrement',
    amount: -125,
    coin: 'substance',
    kind: 'neg',
  },
  {
    ts: '15 May · 09:02',
    desc: 'Inference — Monet',
    sub: '8,402 tokens · Hermes 1.5B',
    amount: -1,
    coin: 'substance',
    kind: 'neg',
  },
]

// ── GGUF filename per the convergence contract ────────────────────────
// e.g. `alchm-agent-water-8b.gguf` for Rumi (Water · premium)
function modelFilename(agent) {
  const size = agent.tier === 'premium' ? '8b' : '1.5b'
  return `alchm-agent-${agent.element.toLowerCase()}-${size}.gguf`
}

// ── Stub SHA-256 hashes for the model catalog ─────────────────────────
// Deterministic mock based on filename; in production these come from
// /api/models/catalog and are verified against on-disk binaries.
function modelSha(agent) {
  const f = modelFilename(agent)
  const h = ['4b8a2a5', 'e6c1f02', 'c91d7b3', '9a4e2c1', '7d3a18f', '2f6b9e4']
  const i = f.charCodeAt(14) % h.length // some character variance
  return h[i] + '...12dcfd45543c98888bf1298c9f8d8b9e8bfd1182df'
}

Object.assign(window, {
  ELEMENTS,
  COINS,
  MODALITIES,
  AURA_PATTERNS,
  CONSCIOUSNESS_LEVELS,
  SACRED_7,
  PLANETARY_12,
  AGENTS,
  DEFAULT_AGENT_ID,
  SAMPLE_THREAD,
  LEDGER_ENTRIES,
  modelFilename,
  modelSha,
})
