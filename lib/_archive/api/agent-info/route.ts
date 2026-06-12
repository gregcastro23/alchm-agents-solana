import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Static agent info mapping to avoid importing DEMO_AGENTS
const AGENT_INFO_MAP: Record<string, { name: string; title: string; symbol: string }> = {
  'leonardo-da-vinci': { name: 'Leonardo da Vinci', title: 'The Renaissance Genius', symbol: '🎨' },
  'carl-jung': { name: 'Carl Jung', title: 'The Shadow Explorer', symbol: '🔮' },
  'marie-curie': { name: 'Marie Curie', title: 'The Radiant Pioneer', symbol: '⚗️' },
  'albert-einstein': { name: 'Albert Einstein', title: 'The Cosmic Thinker', symbol: '🌌' },
  'nikola-tesla': { name: 'Nikola Tesla', title: 'The Electric Visionary', symbol: '⚡' },
  'william-shakespeare': { name: 'William Shakespeare', title: 'The Bard of Avon', symbol: '🎭' },
  cleopatra: { name: 'Cleopatra VII', title: 'The Last Pharaoh', symbol: '👑' },
  aristotle: { name: 'Aristotle', title: 'The First Scientist', symbol: '📚' },
  plato: { name: 'Plato', title: 'The Idealist', symbol: '💭' },
  pythagoras: { name: 'Pythagoras', title: 'The Mathematical Mystic', symbol: '🔺' },
  'lao-tzu': { name: 'Lao Tzu', title: 'The Way Keeper', symbol: '☯️' },
  'joan-of-arc': { name: 'Joan of Arc', title: 'The Maid of Orleans', symbol: '⚔️' },
  'ibn-khaldun': { name: 'Ibn Khaldun', title: 'The Father of Sociology', symbol: '📖' },
  'dante-alighieri': { name: 'Dante Alighieri', title: 'The Divine Poet', symbol: '🕯️' },
  rumi: { name: 'Rumi', title: 'The Whirling Mystic', symbol: '🌟' },
  'galileo-galilei': { name: 'Galileo Galilei', title: 'The Stargazer', symbol: '🔭' },
  michelangelo: { name: 'Michelangelo', title: 'The Divine Artist', symbol: '🗿' },
  'queen-elizabeth-i': { name: 'Queen Elizabeth I', title: 'The Virgin Queen', symbol: '👸' },
  nostradamus: { name: 'Nostradamus', title: 'The Prophet', symbol: '🔮' },
  'benjamin-franklin': { name: 'Benjamin Franklin', title: 'The Practical Polymath', symbol: '⚡' },
  'wolfgang-amadeus-mozart': {
    name: 'Wolfgang Amadeus Mozart',
    title: 'The Musical Prodigy',
    symbol: '🎼',
  },
  'mary-wollstonecraft': { name: 'Mary Wollstonecraft', title: 'The Rights Pioneer', symbol: '✊' },
  voltaire: { name: 'Voltaire', title: 'The Enlightenment Wit', symbol: '✒️' },
  'catherine-the-great': {
    name: 'Catherine the Great',
    title: 'The Enlightened Empress',
    symbol: '👑',
  },
  'ada-lovelace': { name: 'Ada Lovelace', title: 'The First Programmer', symbol: '💻' },
  'charles-darwin': { name: 'Charles Darwin', title: 'The Evolution Pioneer', symbol: '🦎' },
  'florence-nightingale': {
    name: 'Florence Nightingale',
    title: 'The Lady with the Lamp',
    symbol: '🕯️',
  },
  'mark-twain': { name: 'Mark Twain', title: 'The American Humorist', symbol: '📝' },
  'karl-marx': { name: 'Karl Marx', title: 'The Revolutionary Philosopher', symbol: '📜' },
  'sigmund-freud': { name: 'Sigmund Freud', title: 'The Unconscious Explorer', symbol: '🧠' },
  'virginia-woolf': { name: 'Virginia Woolf', title: 'The Stream of Consciousness', symbol: '🖋️' },
  'martin-luther-king-jr': {
    name: 'Martin Luther King Jr.',
    title: 'The Dream Keeper',
    symbol: '✊',
  },
  'frida-kahlo': { name: 'Frida Kahlo', title: 'The Surreal Soul', symbol: '🎨' },
  'alan-turing': { name: 'Alan Turing', title: 'The Code Breaker', symbol: '🔐' },
  'maya-angelou': { name: 'Maya Angelou', title: 'The Caged Bird', symbol: '🕊️' },
  'stephen-hawking': { name: 'Stephen Hawking', title: 'The Universe Explorer', symbol: '🌌' },
  'rene-descartes': { name: 'René Descartes', title: 'The Methodical Skeptic', symbol: '🤔' },
  'john-locke': { name: 'John Locke', title: 'The Empiricist', symbol: '📚' },
  'david-hume': { name: 'David Hume', title: 'The Skeptical Empiricist', symbol: '🔍' },
  'johannes-kepler': { name: 'Johannes Kepler', title: 'The Celestial Harmonist', symbol: '🪐' },
  'immanuel-kant': { name: 'Immanuel Kant', title: 'The Critical Philosopher', symbol: '💭' },
  'adam-smith': { name: 'Adam Smith', title: 'The Wealth Theorist', symbol: '💰' },
  'jean-jacques-rousseau': {
    name: 'Jean-Jacques Rousseau',
    title: 'The Social Contractor',
    symbol: '📜',
  },
  'charles-dickens': { name: 'Charles Dickens', title: 'The Social Chronicler', symbol: '📖' },
  'claude-monet': { name: 'Claude Monet', title: 'The Impressionist Master', symbol: '🎨' },
  'vincent-van-gogh': { name: 'Vincent van Gogh', title: 'The Starry Visionary', symbol: '🌟' },
  'edgar-allan-poe': { name: 'Edgar Allan Poe', title: 'The Dark Romantic', symbol: '🦅' },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('id')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID required' }, { status: 400 })
    }

    // Lookup agent info
    const agentInfo = AGENT_INFO_MAP[agentId]

    if (!agentInfo) {
      // Fallback: generate from ID
      const name = agentId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      return NextResponse.json({
        agent: {
          id: agentId,
          name,
          title: 'Historical Consciousness Agent',
          appearance: { symbol: '👤' },
        },
      })
    }

    return NextResponse.json({
      agent: {
        id: agentId,
        name: agentInfo.name,
        title: agentInfo.title,
        appearance: { symbol: agentInfo.symbol },
      },
    })
  } catch (error) {
    console.error('Error fetching agent info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
