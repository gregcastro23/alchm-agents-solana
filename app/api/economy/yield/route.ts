import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { claimProfileYield } from '@/lib/profile-yield'

export async function POST() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the same service as /yield so balances and daily cooldowns cannot diverge.
    const result = await claimProfileYield(userId, 'agents', {
      kitchenPremium: session.user.kitchenPremium,
    })
    return NextResponse.json({
      success: true,
      distribution: result.distribution,
      balances: result.balances,
      isPremium: result.isPremium,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Already claimed today') {
      return NextResponse.json(
        {
          error: 'Cooldown active',
          message: 'You have already claimed your Alchm Agents ESMS yield today.',
        },
        { status: 409 }
      )
    }

    console.error('Error claiming Alchm Agents ESMS yield:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
