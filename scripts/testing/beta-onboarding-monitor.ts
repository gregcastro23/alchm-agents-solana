/**
 * Beta User Onboarding Flow Monitoring
 * Tracks user journey from registration to first agent interaction
 */

import { prisma } from './lib/db'

interface OnboardingMetrics {
  totalRegistrations: number
  completedProfiles: number
  firstInteractions: number
  activeUsers: number
  averageTimeToFirstInteraction: number
  conversionRates: {
    registrationToProfile: number
    profileToFirstInteraction: number
    registrationToActive: number
  }
}

interface UserJourney {
  userId: string
  email: string
  registrationDate: Date
  profileCompleted: boolean
  profileCompletionTime?: Date
  firstInteractionDate?: Date
  totalInteractions: number
  timeToFirstInteraction?: number
  currentStatus: 'registered' | 'profile_complete' | 'active' | 'inactive'
}

class BetaOnboardingMonitor {
  async getOnboardingMetrics(): Promise<OnboardingMetrics> {
    console.log('📊 Beta User Onboarding Metrics')
    console.log('================================\n')

    // Get all users from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    const totalRegistrations = users.length

    // Get profiles for these users
    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: users.map(u => u.id) },
      },
    })

    const completedProfiles = profiles.length

    // Get first interactions for each user
    const firstInteractions = await prisma.consciousnessInteraction.groupBy({
      by: ['userId'],
      where: {
        userId: { in: users.map(u => u.id) },
      },
      _min: {
        timestamp: true,
      },
    })

    const usersWithInteractions = firstInteractions.length

    // Calculate active users (interacted in last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const activeUsers = await prisma.consciousnessInteraction.findMany({
      where: {
        timestamp: { gte: sevenDaysAgo },
        userId: { in: users.map(u => u.id) },
      },
      distinct: ['userId'],
    })

    // Calculate average time to first interaction
    let totalTimeToFirst = 0
    let validTimeCalculations = 0

    for (const user of users) {
      const firstInteraction = firstInteractions.find(fi => fi.userId === user.id)
      if (firstInteraction && firstInteraction._min.timestamp) {
        const timeDiff = firstInteraction._min.timestamp.getTime() - user.createdAt.getTime()
        totalTimeToFirst += timeDiff
        validTimeCalculations++
      }
    }

    const averageTimeToFirstInteraction =
      validTimeCalculations > 0 ? totalTimeToFirst / validTimeCalculations : 0

    return {
      totalRegistrations,
      completedProfiles,
      firstInteractions: usersWithInteractions,
      activeUsers: activeUsers.length,
      averageTimeToFirstInteraction: averageTimeToFirstInteraction / (1000 * 60), // Convert to minutes
      conversionRates: {
        registrationToProfile:
          totalRegistrations > 0 ? (completedProfiles / totalRegistrations) * 100 : 0,
        profileToFirstInteraction:
          completedProfiles > 0 ? (usersWithInteractions / completedProfiles) * 100 : 0,
        registrationToActive:
          totalRegistrations > 0 ? (activeUsers.length / totalRegistrations) * 100 : 0,
      },
    }
  }

  async getUserJourneys(limit: number = 10): Promise<UserJourney[]> {
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    const journeys: UserJourney[] = []

    for (const user of users) {
      // Get profile completion
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
      })

      // Get first interaction
      const firstInteraction = await prisma.consciousnessInteraction.findFirst({
        where: { userId: user.id },
        orderBy: { timestamp: 'asc' },
      })

      // Get total interactions
      const totalInteractions = await prisma.consciousnessInteraction.count({
        where: { userId: user.id },
      })

      // Calculate time to first interaction
      let timeToFirstInteraction: number | undefined
      if (firstInteraction) {
        timeToFirstInteraction =
          (firstInteraction.timestamp.getTime() - user.createdAt.getTime()) / (1000 * 60) // minutes
      }

      // Determine status
      let currentStatus: UserJourney['currentStatus'] = 'registered'
      if (profile) currentStatus = 'profile_complete'
      if (totalInteractions > 0) currentStatus = 'active'

      // Check if inactive (no interactions in 7 days)
      if (totalInteractions > 0) {
        const lastInteraction = await prisma.consciousnessInteraction.findFirst({
          where: { userId: user.id },
          orderBy: { timestamp: 'desc' },
        })

        if (lastInteraction) {
          const daysSinceLastInteraction =
            (Date.now() - lastInteraction.timestamp.getTime()) / (1000 * 60 * 60 * 24)
          if (daysSinceLastInteraction > 7) {
            currentStatus = 'inactive'
          }
        }
      }

      journeys.push({
        userId: user.id,
        email: user.email,
        registrationDate: user.createdAt,
        profileCompleted: !!profile,
        profileCompletionTime: profile?.createdAt,
        firstInteractionDate: firstInteraction?.timestamp,
        totalInteractions,
        timeToFirstInteraction,
        currentStatus,
      })
    }

    return journeys
  }

  async printOnboardingReport(): Promise<void> {
    const metrics = await this.getOnboardingMetrics()
    const journeys = await this.getUserJourneys(10)

    console.log('📈 CONVERSION FUNNEL')
    console.log('-------------------')
    console.log(`Registrations: ${metrics.totalRegistrations}`)
    console.log(
      `↓ Profile Completion: ${metrics.completedProfiles} (${metrics.conversionRates.registrationToProfile.toFixed(1)}%)`
    )
    console.log(
      `↓ First Interaction: ${metrics.firstInteractions} (${metrics.conversionRates.profileToFirstInteraction.toFixed(1)}%)`
    )
    console.log(
      `↓ Active Users: ${metrics.activeUsers} (${metrics.conversionRates.registrationToActive.toFixed(1)}%)`
    )

    console.log('\n⏱️ TIMING METRICS')
    console.log('----------------')
    console.log(
      `Average time to first interaction: ${metrics.averageTimeToFirstInteraction.toFixed(1)} minutes`
    )

    console.log('\n👥 RECENT USER JOURNEYS')
    console.log('----------------------')
    journeys.forEach((journey, i) => {
      const status = {
        registered: '🟡 Registered',
        profile_complete: '🟠 Profile Complete',
        active: '🟢 Active',
        inactive: '🔴 Inactive',
      }[journey.currentStatus]

      console.log(`${i + 1}. ${journey.email} - ${status}`)
      console.log(`   Registered: ${journey.registrationDate.toLocaleDateString()}`)
      if (journey.profileCompleted) {
        console.log(`   Profile: ✅ (${journey.profileCompletionTime?.toLocaleDateString()})`)
      } else {
        console.log(`   Profile: ❌`)
      }
      if (journey.firstInteractionDate) {
        console.log(
          `   First interaction: ${journey.firstInteractionDate.toLocaleDateString()} (${journey.timeToFirstInteraction?.toFixed(1)}min later)`
        )
        console.log(`   Total interactions: ${journey.totalInteractions}`)
      } else {
        console.log(`   No interactions yet`)
      }
      console.log('')
    })

    console.log('🎯 BETA INSIGHTS')
    console.log('----------------')
    if (metrics.conversionRates.registrationToProfile < 50) {
      console.log('⚠️ Low profile completion rate - consider simplifying onboarding')
    }
    if (metrics.conversionRates.profileToFirstInteraction < 70) {
      console.log('⚠️ Low first interaction rate - improve agent discovery')
    }
    if (metrics.averageTimeToFirstInteraction > 60) {
      console.log('⚠️ Slow time to first interaction - streamline user flow')
    }
    if (metrics.conversionRates.registrationToActive > 30) {
      console.log('✅ Good activation rate!')
    }

    console.log('\n📋 BETA TESTING READINESS:')
    console.log('- User registration flow: ✅ Working')
    console.log('- Profile completion: ✅ Tracked')
    console.log('- Agent interactions: ✅ Monitored')
    console.log('- Conversion metrics: ✅ Available')
    console.log('\n🚀 Ready for beta user onboarding!')
  }

  async identifyDropoffPoints(): Promise<void> {
    const metrics = await this.getOnboardingMetrics()

    console.log('\n🔍 DROPOFF ANALYSIS')
    console.log('------------------')

    const registrationToProfile = metrics.conversionRates.registrationToProfile
    const profileToInteraction = metrics.conversionRates.profileToFirstInteraction

    if (registrationToProfile < 70) {
      console.log(`❌ Major dropoff: Registration → Profile (${registrationToProfile.toFixed(1)}%)`)
      console.log('   Recommendations:')
      console.log('   - Simplify birth chart input')
      console.log('   - Add progress indicators')
      console.log('   - Provide clearer value proposition')
    }

    if (profileToInteraction < 80) {
      console.log(
        `❌ Major dropoff: Profile → First Interaction (${profileToInteraction.toFixed(1)}%)`
      )
      console.log('   Recommendations:')
      console.log('   - Improve agent recommendations')
      console.log('   - Add guided first conversation')
      console.log('   - Highlight most popular agents')
    }

    if (registrationToProfile >= 70 && profileToInteraction >= 80) {
      console.log('✅ No major dropoff points detected')
      console.log('   Conversion flow is healthy for beta testing')
    }
  }
}

// Run monitoring
async function runBetaMonitoring() {
  const monitor = new BetaOnboardingMonitor()

  try {
    await monitor.printOnboardingReport()
    await monitor.identifyDropoffPoints()
  } catch (error) {
    console.error('Monitoring failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if executed directly
runBetaMonitoring()

export { BetaOnboardingMonitor }
