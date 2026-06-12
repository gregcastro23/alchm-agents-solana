import type {
  Sign,
  PlanetName,
  PlanetInfo,
  Element,
  JingMoveId,
  JingMove,
  AspectType,
} from './types'

export const SIGNS: Sign[] = [
  { name: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars' },
  { name: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus' },
  { name: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury' },
  { name: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'Moon' },
  { name: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'Sun' },
  { name: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury' },
  { name: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus' },
  { name: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto' },
  { name: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter' },
  { name: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn' },
  { name: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'Uranus' },
  { name: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune' },
]

export const PLANETS: Record<PlanetName, PlanetInfo> = {
  Sun: { glyph: '☉', element: 'Fire', color: '#f5b542' },
  Moon: { glyph: '☽', element: 'Water', color: '#cfd6e8' },
  Mercury: { glyph: '☿', element: 'Air', color: '#9bd0ff' },
  Venus: { glyph: '♀', element: 'Water', color: '#f4a8c8' },
  Mars: { glyph: '♂', element: 'Fire', color: '#ef5d4e' },
  Jupiter: { glyph: '♃', element: 'Air', color: '#c89b6a' },
  Saturn: { glyph: '♄', element: 'Earth', color: '#8a8aa3' },
  Uranus: { glyph: '♅', element: 'Air', color: '#7ad1c4' },
  Neptune: { glyph: '♆', element: 'Water', color: '#7ea0e8' },
  Pluto: { glyph: '♇', element: 'Earth', color: '#a07090' },
}

export const ELEMENT_COLOR: Record<Element, string> = {
  Fire: '#ef5d4e',
  Water: '#5e9bd6',
  Earth: '#8aa56a',
  Air: '#d9c87a',
}

export const ASP_SYM: Record<AspectType, string> = {
  conjunction: '☌',
  sextile: '⚹',
  square: '□',
  trine: '△',
  opposition: '☍',
}

export const JING_MOVES: Record<JingMoveId, JingMove> = {
  meltdown: {
    name: 'Meltdown',
    element: 'Fire',
    type: 'Positive',
    threshold: 30,
    description: 'Shatters structural barriers. Doubles intensity.',
    cost: { stat: 'vitality', amount: 15, secondary: { stat: 'spirit', amount: 10 } },
    counters: ['freeze', 'tectonicRoot'],
    counteredBy: ['vacuum'],
    glyph: '🜂',
  },
  freeze: {
    name: 'Freeze',
    element: 'Water',
    type: 'Dynamic',
    threshold: 30,
    description: 'Locks opponent stance. Forces silence or rigidity.',
    cost: { stat: 'adaptability', amount: 15, secondary: { stat: 'substance', amount: 10 } },
    counters: ['meltdown'],
    counteredBy: ['meltdown'],
    glyph: '🜄',
  },
  tectonicRoot: {
    name: 'Tectonic Root',
    element: 'Earth',
    type: 'Neutral',
    threshold: 30,
    description: 'Impenetrable defense. Deflects emotional/kinetic args.',
    cost: { stat: 'mercurialVelocity', amount: 15 },
    counters: ['meltdown'],
    counteredBy: ['erode'],
    glyph: '🜃',
  },
  vacuum: {
    name: 'Vacuum',
    element: 'Air',
    type: 'Negative',
    threshold: 30,
    description: 'Removes oxygen. Neutralizes fiery enthusiasm.',
    cost: { stat: 'charisma', amount: 15, secondary: { stat: 'venusianCoherence', amount: 10 } },
    counters: ['meltdown'],
    counteredBy: ['freeze'],
    glyph: '🜁',
  },
  erode: {
    name: 'Erode',
    element: 'Water·Earth',
    type: 'Dynamic-Neutral',
    threshold: 30,
    description: 'Dissolves Saturnian logic. Slow wear.',
    cost: { stat: 'wisdom', amount: 10, secondary: { stat: 'matter', amount: 10 } },
    counters: ['tectonicRoot'],
    counteredBy: ['vacuum'],
    glyph: '🜔',
  },
}

export const SACRED7_KEYS: Array<keyof import('./types').Sacred7Stats> = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
]
