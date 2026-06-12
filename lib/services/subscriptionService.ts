import { prisma } from '@/lib/db'

export class SubscriptionService {
  /**
   * Check if a user is a Premium subscriber.
   * Based on user_subscriptions table having tier = 'premium' and status = 'active'.
   */
  static async isPremium(userId: string): Promise<boolean> {
    try {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId },
      })

      if (!subscription) return false

      return subscription.tier === 'premium' && subscription.status === 'active'
    } catch (error) {
      console.error('Error checking premium status:', error)
      return false
    }
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
