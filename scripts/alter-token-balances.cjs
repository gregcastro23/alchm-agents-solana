const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({
  datasourceUrl:
    'postgresql://postgres:PsVTYtMbsWtMhykqZbzgzJUpMmrzKKoD@tramway.proxy.rlwy.net:35670/alchm_kitchen',
})

async function main() {
  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `)
    console.log('Tables in alchm_kitchen:', tables)
  } catch (e) {
    console.error('Error executing query:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
