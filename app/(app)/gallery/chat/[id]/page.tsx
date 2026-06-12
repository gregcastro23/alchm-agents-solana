import HistoricalAgentChatPage from './chat-client'

// Allow dynamic params - this route can handle any agent ID beyond the pre-generated ones
export const dynamicParams = true

import { HISTORICAL_AGENTS } from '@/lib/agents/historical'

// Pre-generate pages for ALL historical agents at build time
export async function generateStaticParams() {
  return HISTORICAL_AGENTS.map(agent => ({ id: agent.id }))
}

export default function Page() {
  return <HistoricalAgentChatPage />
}
