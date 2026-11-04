import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface CulinaryRedirectProps {
  searchParams?: Promise<{
    agent?: string
    [key: string]: string | string[] | undefined
  }>
}

/**
 * Pure External Redirect Bridge:
 * alchm-agents-solana powers agents.alchm.kitchen ONLY.
 * alchm.kitchen is the sole canonical source of truth and primary UX destination
 * for all culinary data (WTEN 1,000-recipe catalog, alterations, and recipes).
 * Any legacy or incoming /culinary?agent=... request forwards directly to alchm.kitchen.
 */
export default async function CulinaryRedirectPage({ searchParams }: CulinaryRedirectProps) {
  const resolved = (await searchParams) ?? {}
  const agentParam = typeof resolved.agent === 'string' ? resolved.agent.trim() : null
  const kitchenBase = (
    process.env.NEXT_PUBLIC_KITCHEN_URL ||
    process.env.ALCHM_KITCHEN_URL ||
    process.env.ALCHM_KITCHEN_BASE_URL ||
    'https://alchm.kitchen'
  ).replace(/\/+$/, '')

  const targetUrl = agentParam
    ? `${kitchenBase}/recipes?agent=${encodeURIComponent(agentParam)}`
    : `${kitchenBase}/recipes`

  redirect(targetUrl)
}
