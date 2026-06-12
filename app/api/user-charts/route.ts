import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const SaveChartSchema = z.object({
  userId: z.string(),
  birthData: z.object({
    birthDate: z.string(),
    birthTime: z.string().optional(),
    birthLocation: z.object({
      name: z.string().optional(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
  natalChart: z.any(),
})

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const requestedUserId = searchParams.get('userId')

  const session = await auth().catch(() => null)
  const userId = requestedUserId || session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await prisma.user_profiles.findUnique({ where: { userId } })
  return NextResponse.json({ profile })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = SaveChartSchema.parse(body)

    const saved = await prisma.user_profiles.upsert({
      where: { userId: parsed.userId },
      update: {
        birthDate: new Date(parsed.birthData.birthDate),
        birthTime: parsed.birthData.birthTime,
        birthLocation: parsed.birthData.birthLocation,
        natalChart: parsed.natalChart,
      },
      create: {
        userId: parsed.userId,
        birthDate: new Date(parsed.birthData.birthDate),
        birthTime: parsed.birthData.birthTime,
        birthLocation: parsed.birthData.birthLocation,
        natalChart: parsed.natalChart,
        monicaConstant: 0,
        dominantElement: 'Fire',
      },
    })

    return NextResponse.json({ profile: saved })
  } catch (error) {
    console.error('Failed to save chart:', error)
    return NextResponse.json({ error: 'Failed to save chart' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const parsed = SaveChartSchema.parse(body)

    const updated = await prisma.user_profiles.update({
      where: { userId: parsed.userId },
      data: {
        birthDate: new Date(parsed.birthData.birthDate),
        birthTime: parsed.birthData.birthTime,
        birthLocation: parsed.birthData.birthLocation,
        natalChart: parsed.natalChart,
      },
    })

    return NextResponse.json({ profile: updated })
  } catch (error) {
    console.error('Failed to update chart:', error)
    return NextResponse.json({ error: 'Failed to update chart' }, { status: 500 })
  }
}
