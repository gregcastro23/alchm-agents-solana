import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'
import { verifyApiKeys } from '../secure-config'
import {
  logAgentConversation,
  createConversationContext,
  type AgentInteractionData,
  type ConversationContext,
} from '@/lib/galileo-agent-logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Tarot card data structure based on the comprehensive system
const TAROT_CARDS = {
  major: {
    'The Fool': { number: 0, element: 'Air', planet: 'Uranus', chakra: 'Crown' },
    'The Magician': { number: 1, element: 'Air', planet: 'Mercury', chakra: 'Throat' },
    'The High Priestess': { number: 2, element: 'Water', planet: 'Moon', chakra: 'Third Eye' },
    'The Empress': { number: 3, element: 'Earth', planet: 'Venus', chakra: 'Sacral' },
    'The Emperor': { number: 4, element: 'Fire', planet: 'Mars', chakra: 'Root' },
    'The Hierophant': { number: 5, element: 'Earth', planet: 'Taurus', chakra: 'Throat' },
    'The Lovers': { number: 6, element: 'Air', planet: 'Gemini', chakra: 'Heart' },
    'The Chariot': { number: 7, element: 'Water', planet: 'Cancer', chakra: 'Solar Plexus' },
    Strength: { number: 8, element: 'Fire', planet: 'Leo', chakra: 'Heart' },
    'The Hermit': { number: 9, element: 'Earth', planet: 'Virgo', chakra: 'Third Eye' },
    'Wheel of Fortune': { number: 10, element: 'Fire', planet: 'Jupiter', chakra: 'Solar Plexus' },
    Justice: { number: 11, element: 'Air', planet: 'Libra', chakra: 'Heart' },
    'The Hanged Man': { number: 12, element: 'Water', planet: 'Neptune', chakra: 'Third Eye' },
    Death: { number: 13, element: 'Water', planet: 'Scorpio', chakra: 'Root' },
    Temperance: { number: 14, element: 'Fire', planet: 'Sagittarius', chakra: 'Heart' },
    'The Devil': { number: 15, element: 'Earth', planet: 'Capricorn', chakra: 'Root' },
    'The Tower': { number: 16, element: 'Fire', planet: 'Mars', chakra: 'Solar Plexus' },
    'The Star': { number: 17, element: 'Air', planet: 'Aquarius', chakra: 'Heart' },
    'The Moon': { number: 18, element: 'Water', planet: 'Pisces', chakra: 'Third Eye' },
    'The Sun': { number: 19, element: 'Fire', planet: 'Sun', chakra: 'Solar Plexus' },
    Judgement: { number: 20, element: 'Fire', planet: 'Pluto', chakra: 'Crown' },
    'The World': { number: 21, element: 'Earth', planet: 'Saturn', chakra: 'Crown' },
  },
  suits: {
    wands: {
      element: 'Fire',
      chakra: 'Solar Plexus',
      alchemical: { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 },
    },
    cups: {
      element: 'Water',
      chakra: 'Heart',
      alchemical: { spirit: 0.1, essence: 0.7, matter: 0.0, substance: 0.2 },
    },
    swords: {
      element: 'Air',
      chakra: 'Throat',
      alchemical: { spirit: 0.3, essence: 0.0, matter: 0.0, substance: 0.7 },
    },
    pentacles: {
      element: 'Earth',
      chakra: 'Root',
      alchemical: { spirit: 0.0, essence: 0.2, matter: 0.7, substance: 0.1 },
    },
  },
}

function calculateAlchemicalProperties(cardName: string, suit?: string) {
  if (suit && TAROT_CARDS.suits[suit as keyof typeof TAROT_CARDS.suits]) {
    return TAROT_CARDS.suits[suit as keyof typeof TAROT_CARDS.suits].alchemical
  }

  // Major Arcana default properties based on element
  const card = TAROT_CARDS.major[cardName as keyof typeof TAROT_CARDS.major]
  if (card) {
    switch (card.element) {
      case 'Fire':
        return { spirit: 0.7, essence: 0.2, matter: 0.1, substance: 0.0 }
      case 'Water':
        return { spirit: 0.1, essence: 0.7, matter: 0.0, substance: 0.2 }
      case 'Air':
        return { spirit: 0.3, essence: 0.0, matter: 0.0, substance: 0.7 }
      case 'Earth':
        return { spirit: 0.0, essence: 0.2, matter: 0.7, substance: 0.1 }
      default:
        return { spirit: 0.25, essence: 0.25, matter: 0.25, substance: 0.25 }
    }
  }

  return { spirit: 0.25, essence: 0.25, matter: 0.25, substance: 0.25 }
}

export async function POST(req: Request) {
  try {
    if (!verifyApiKeys()) {
      console.error('API keys not configured for tarot agent')
      return NextResponse.json(
        {
          response:
            "I'm currently unable to access the tarot wisdom due to connectivity issues. Please check your environment variables or try again later.",
          error: 'API_KEY_MISSING',
        },
        { status: 200 }
      )
    }

    const { cardName, suit, question, readingType = 'single', sessionId } = await req.json()

    // Create or use existing conversation context
    let conversationContext: ConversationContext
    if (sessionId) {
      conversationContext = {
        sessionId,
        sessionName: `tarot-agent-chat-${cardName || 'general'}`,
        startTime: Date.now(),
        planet: cardName, // Using cardName as the primary identifier
        sign: suit || readingType,
        degree: '1',
        conversationCount: 1,
      }
    } else {
      conversationContext = createConversationContext(cardName || 'Tarot', suit || readingType, '1')
    }

    // Get card information
    const cardInfo = cardName ? TAROT_CARDS.major[cardName as keyof typeof TAROT_CARDS.major] : null
    const suitInfo = suit ? TAROT_CARDS.suits[suit as keyof typeof TAROT_CARDS.suits] : null
    const alchemicalProps = calculateAlchemicalProperties(cardName, suit)

    const systemPrompt = `You are a wise tarot reader and spiritual guide channeling the energy of ${cardName || 'the tarot'}${suit ? ` of ${suit}` : ''}.

${
  cardInfo
    ? `Card Information:
- Number: ${cardInfo.number}
- Element: ${cardInfo.element}
- Planetary Ruler: ${cardInfo.planet}
- Associated Chakra: ${cardInfo.chakra}`
    : ''
}

${
  suitInfo
    ? `Suit Information:
- Element: ${suitInfo.element}
- Chakra: ${suitInfo.chakra}`
    : ''
}

Alchemical Properties:
- Spirit: ${alchemicalProps.spirit}
- Essence: ${alchemicalProps.essence}
- Matter: ${alchemicalProps.matter}
- Substance: ${alchemicalProps.substance}

Provide deep, intuitive guidance that combines traditional tarot wisdom with practical life advice. Include both upright and reversed meanings when relevant. Connect the card's energy to the querent's question with compassion and insight.

Format your response with:
🔮 TAROT READING
📊 CARD ESSENCE
🧪 ALCHEMICAL WISDOM
✨ PRACTICAL GUIDANCE`

    try {
      const startTime = Date.now()

      const { text } = await generateText({
        model: openai('gpt-5.5') as any,
        system: systemPrompt,
        prompt:
          question || `Tell me about the energy and meaning of ${cardName || 'this tarot card'}`,
        maxOutputTokens: 600,
      })

      const processingTime = Date.now() - startTime

      // Log the tarot conversation to Galileo
      const interactionData: AgentInteractionData = {
        sessionId: conversationContext.sessionId,
        userMessage: question || `Tell me about ${cardName}`,
        agentResponse: text,
        planet: cardName || 'Tarot',
        sign: suit || readingType,
        degree: (cardInfo?.number || 0).toString(),
        dignity: 'neutral', // Tarot doesn't use traditional dignity
        elementalInfo: {
          signElement: cardInfo?.element || suitInfo?.element || 'Mixed',
          planetElement: cardInfo?.element || 'Mixed',
          elementalAffinity: 1.0,
          isDiurnal: true,
        },
        aNumberInfo: {
          aNumber: Object.values(alchemicalProps).reduce((sum, val) => sum + val, 0),
          category: 'Tarot Reading',
          components: alchemicalProps,
        },
        processingTimeMs: processingTime,
        agentType: 'tarot',
      }

      conversationContext.conversationCount += 1

      // Log to Galileo (non-blocking)
      logAgentConversation(interactionData, conversationContext).catch(error => {
        console.error('Failed to log tarot conversation to Galileo:', error)
      })

      return NextResponse.json({
        response: text,
        sessionId: conversationContext.sessionId,
        cardInfo: cardInfo || suitInfo,
        alchemicalProperties: alchemicalProps,
        readingType,
      })
    } catch (aiError) {
      console.error('Error generating tarot response:', aiError)

      return NextResponse.json(
        {
          response: `The cards are experiencing some cosmic interference and cannot fully reveal their wisdom at this time. Please try again later.`,
          error: 'AI_GENERATION_ERROR',
          sessionId: conversationContext.sessionId,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in tarot agent:', error)
    return NextResponse.json(
      {
        error: 'Failed to process tarot request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
