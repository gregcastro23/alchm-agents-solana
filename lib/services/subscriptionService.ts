import { prisma } from '@/lib/db'

export class SubscriptionService {
  /**
   * @deprecated Premium tier has been eliminated across ASOL in favor of universal 24.0000 ESMS yield.
   */
  static async isPremium(_userId: string): Promise<boolean> {
    return false
  }

  /**
   * Get the user's subscription tier.
   */
  static async getTier(userId: string): Promise<string> {
    try {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
      })

      if (!subscription || subscription.status !== 'active') return 'free'

      return subscription.tier
    } catch (error) {
      console.error('Error getting subscription tier:', error)
      return 'free'
    }
  }
}
