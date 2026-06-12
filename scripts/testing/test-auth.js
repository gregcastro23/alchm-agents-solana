const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function testAuthentication() {
  try {
    console.log('🔐 Testing authentication system...\n')

    // Test 1: Check if test user exists
    console.log('1. Checking if test user exists...')
    const user = await prisma.user.findUnique({
      where: { email: 'test@planetaryagents.com' },
      include: {
        userProfile: true,
        subscription: true,
      },
    })

    if (!user) {
      console.log('❌ Test user not found!')
      return
    }

    console.log('✅ Test user found!')
    console.log('   - ID:', user.id)
    console.log('   - Email:', user.email)
    console.log('   - Name:', user.name)
    console.log('   - Has Profile:', !!user.userProfile)
    console.log('   - Has Subscription:', !!user.subscription)

    // Test 2: Verify password
    console.log('\n2. Testing password verification...')
    const passwordValid = await bcrypt.compare('testpass123', user.passwordHash)

    if (passwordValid) {
      console.log('✅ Password verification successful!')
    } else {
      console.log('❌ Password verification failed!')
    }

    // Test 3: Check Monica settings
    console.log('\n3. Checking Monica settings...')
    const monicaSettings = await prisma.monicaUserSettings.findUnique({
      where: { userId: user.id },
    })

    if (monicaSettings) {
      console.log('✅ Monica settings found!')
      console.log('   - Personality:', monicaSettings.personality)
      console.log('   - Assistance Level:', monicaSettings.assistanceLevel)
      console.log('   - Learning Style:', monicaSettings.learningStyle)
    } else {
      console.log('❌ Monica settings not found!')
    }

    // Test 4: Check profile data
    console.log('\n4. Checking profile data...')
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })

    if (profile) {
      console.log('✅ Basic profile found!')
      const birthInfo = JSON.parse(profile.birthInfo)
      console.log('   - Birth Year:', birthInfo.year)
      console.log('   - Birth Month:', birthInfo.month + 1) // 0-based to 1-based
      console.log('   - Birth Day:', birthInfo.day)
    } else {
      console.log('❌ Basic profile not found!')
    }

    console.log('\n🎉 Authentication system test complete!')
    console.log('\n📝 Test Account Summary:')
    console.log('   Email: test@planetaryagents.com')
    console.log('   Password: testpass123')
    console.log('   Sign In URL: http://localhost:3000/auth/signin')
  } catch (error) {
    console.error('❌ Error during authentication test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAuthentication()
