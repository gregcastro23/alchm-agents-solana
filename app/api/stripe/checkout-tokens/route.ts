import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { auth } from '@/lib/auth'
import { getStripe } from '@/lib/stripe/client'
import { prisma } from '@/lib/db'
import { buildTokenShopHref } from '@/lib/shop/navigation'
import { getTokenBundle } from '@/lib/shop/token-bundles'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  const email = session?.user?.email || undefined
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { tier?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const bundle = getTokenBundle(body.tier ?? '5')
  if (!bundle) {
    return NextResponse.json({ error: 'Unknown ESMS token bundle' }, { status: 400 })
  }

  const stripe = getStripe()
  const origin = new URL(request.url).origin

  // Retrieve user's stripe customer id if available
  const existing = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  })

  // Calculate the amount of each token (spirit, essence, matter, substance)
  // Split evenly by 4
  const perType = bundle.perAxis

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${bundle.name} — ${bundle.tokens} ESMS Tokens`,
            description: `Receive ${perType} Spirit, ${perType} Essence, ${perType} Matter, and ${perType} Substance ESMS tokens (total: ${bundle.tokens}).`,
          },
          unit_amount: bundle.usdCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}${buildTokenShopHref({ purchase: 'success', tokens: String(bundle.tokens) })}`,
    cancel_url: `${origin}${buildTokenShopHref({ purchase: 'cancelled' })}`,
    client_reference_id: userId,
    metadata: {
      userId,
      type: 'token_purchase',
      tokenCount: String(bundle.tokens),
      spirit: String(perType),
      essence: String(perType),
      matter: String(perType),
      substance: String(perType),
    },
  }

  if (existing?.stripeCustomerId) params.customer = existing.stripeCustomerId
  else if (email) params.customer_email = email

  try {
    const checkout = await stripe.checkout.sessions.create(params)
    return NextResponse.json({ url: checkout.url })
  } catch (err: any) {
    console.error('Failed to create stripe checkout session for tokens:', err)
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 })
  }
}
