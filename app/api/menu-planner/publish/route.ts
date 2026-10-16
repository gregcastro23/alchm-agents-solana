import { publishWeeklyMenu } from '@/lib/menu-publication'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return publishWeeklyMenu(request)
}
