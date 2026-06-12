import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.users.upsert({
    where: { email: 'gregcastro23@gmail.com' },
    update: { role: 'admin', name: 'Greg Castro' },
    create: {
      email: 'gregcastro23@gmail.com',
      name: 'Greg Castro',
      role: 'admin',
      provider: 'google',
      verified: true,
    },
  })

  console.log('Admin user seeded:', user.id, user.email, user.role)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
