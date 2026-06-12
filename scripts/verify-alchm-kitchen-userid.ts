import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.users.findMany({
    where: { isAgentic: true },
    select: { email: true, alchmKitchenUserId: true },
    take: 5,
  })

  const totalAgentic = await prisma.users.count({ where: { isAgentic: true } })
  const withId = await prisma.users.count({
    where: { isAgentic: true, alchmKitchenUserId: { not: null } },
  })

  console.log(`agentic users: ${totalAgentic}, with alchmKitchenUserId: ${withId}`)
  console.log('sample (first 5):')
  console.table(users)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
