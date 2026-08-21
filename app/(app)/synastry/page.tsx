import { permanentRedirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SynastryIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string | string[] }>
}) {
  const params = await searchParams
  const rawAgent = (Array.isArray(params.agent) ? params.agent[0] : params.agent)?.trim()

  if (rawAgent) {
    return permanentRedirect(`/synastry/${encodeURIComponent(rawAgent)}`)
  }

  return permanentRedirect('/arena')
}
