import { handleDuelAttestation } from '@/lib/solana/duel-attestation-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request): Promise<Response> {
  return handleDuelAttestation(req)
}
