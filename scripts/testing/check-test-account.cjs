const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function checkAndCreateTestAccount() {
  try {
    console.log('🔍 Checking for test account...')

    // Check if test account exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@planetaryagents.com' },
      include: {
        userProfile: true,
      },
    })

    if (existingUser) {
      // Check for Monica settings separately
      const monicaSettings = await prisma.monicaUserSettings.findUnique({
        where: { userId: existingUser.id },
      })

      // Check for basic profile separately
      const profile = await prisma.profile.findUnique({
        where: { userId: existingUser.id },
      })

      existingUser.monicaUserSettings = monicaSettings
      existingUser.profile = profile
    }

    if (existingUser) {
      console.log('✅ Test account found!')
      console.log('User ID:', existingUser.id)
      console.log('Email:', existingUser.email)
      console.log('Name:', existingUser.name)
      console.log('Has Profile:', !!existingUser.userProfile)
      console.log('Has Settings:', !!existingUser.monicaUserSettings)
      console.log('Has Basic Profile:', !!existingUser.profile)
      return existingUser
    }

    console.log('❌ Test account not found. Creating...')

    // Create test account
    const hashedPassword = await bcrypt.hash('testpass123', 12)

    const user = await prisma.user.create({
      data: {
        id: 'cmft0cy4c00001yjsum69dqhj',
        email: 'test@planetaryagents.com',
        name: 'Test Explorer',
        passwordHash: hashedPassword,
        verified: true,
      },
    })

    console.log('✅ User created:', user.id)

    // Create user profile with birth chart
    const userProfile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        birthDate: new Date(1990, 5, 15), // June 15, 1990 (month is 0-based)
        birthTime: '14:30',
        birthLocation: {
          name: 'New York City',
          latitude: 40.7128,
          longitude: -74.006,
        },
        natalChart: {
          year: 1990,
          month: 5, // 0-based for storage
          day: 15,
          hour: 14,
          minute: 30,
          latitude: 40.7128,
          longitude: -74.006,
          name: 'Test Explorer',
        },
        monicaConstant: 2.1,
        dominantElement: 'Fire',
      },
    })

    console.log('✅ UserProfile created')

    // Create basic profile
    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        name: 'Test Explorer',
        birthInfo: JSON.stringify({
          year: 1990,
          month: 5,
          day: 15,
          hour: 14,
          minute: 30,
          latitude: 40.7128,
          longitude: -74.006,
          name: 'Test Explorer',
        }),
      },
    })

    console.log('✅ Basic Profile created')

    // Create Monica settings
    const settings = await prisma.monicaUserSettings.create({
      data: {
        userId: user.id,
        personality: 'mixed',
        assistanceLevel: 2,
        proactiveTips: true,
        explanationDepth: 'detailed',
        position: 'bottom-right',
        autoHide: 'never',
        preferredTime: 'evening',
        learningStyle: 'hands-on',
        contextualAwareness: true,
        adaptivePersonality: true,
        memoryRetention: true,
        interests: JSON.stringify({
          notifications: {
            powerHours: true,
            evolutionMilestones: true,
            weeklyProgress: true,
            agentRecommendations: true,
            emailFrequency: 'weekly',
          },
          privacy: {
            profileVisibility: 'private',
            shareEvolutionData: false,
            allowDataExport: true,
            analyticsOptOut: false,
          },
        }),
      },
    })

    console.log('✅ Monica settings created')

    console.log('🎉 Test account created successfully!')
    console.log('Email: test@planetaryagents.com')
    console.log('Password: testpass123')
    console.log('User ID:', user.id)

    return user
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAndCreateTestAccount()
