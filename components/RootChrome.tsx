'use client'

import { usePathname } from 'next/navigation'

import { Navigation } from '@/components/Navigation'
import { TokenHUD } from '@/components/TokenHUD'

export function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLandingSurface = pathname === '/'
  const isDesktopSurface = pathname?.startsWith('/desktop')
  // /yield and /economy are dedicated ESMS treasury surfaces — hide bottom-right HUD duplication.
  const isTreasurySurface =
    pathname === '/yield' ||
    pathname?.startsWith('/yield/') ||
    pathname === '/economy' ||
    pathname?.startsWith('/economy/')
  const hideHud = isLandingSurface || isDesktopSurface || isTreasurySurface

  return (
    <>
      {!isLandingSurface && !isDesktopSurface && <Navigation />}
      <main className="flex-1 min-h-[calc(100vh-4rem)]">{children}</main>
      {!hideHud && <TokenHUD />}
    </>
  )
}
