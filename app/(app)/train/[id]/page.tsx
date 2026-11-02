import { permanentRedirect } from 'next/navigation'

export default async function TrainAgentRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  permanentRedirect(`/agent/${encodeURIComponent(id)}`)
}
