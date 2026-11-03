import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import './navigation.css'
import './techno-occult.css'
import '@solana/wallet-adapter-react-ui/styles.css'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { RootChrome } from '@/components/RootChrome'
import { resolvePublicOrigin } from '@/lib/self-origin'

// Alchm Design System type families (self-hosted via next/font/local so CI and
// production builds never depend on outbound fonts.googleapis.com fetches).
// Exposed as CSS variables and consumed by app/globals.css (--ff-ui / --ff-display / --ff-mono)
// + tailwind.config.ts.
const manrope = localFont({
  src: './fonts/manrope-latin.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-manrope',
})

const cormorant = localFont({
  src: './fonts/cormorant-garamond-latin.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-cormorant',
})

const ibmPlexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-600-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
})

// Techno-Occult v2 families (Stitch prototypes): Literata for headlines,
// JetBrains Mono for Sacred-7 stats / labels. Consumed by the
// font-headline-* / font-label-mono utilities in tailwind.config.ts.
const literata = localFont({
  src: './fonts/literata-latin.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-literata',
})

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  // Production must resolve relative canonical/OG URLs against the custom
  // domain: every *.vercel.app host is behind Standard Protection.
  metadataBase: new URL(resolvePublicOrigin()),
  title: 'Planetary Agents - Consciousness Evolution Platform',
  description:
    'Revolutionary consciousness evolution through AI-powered planetary agents and real-time cosmic integration',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${manrope.variable} ${cormorant.variable} ${ibmPlexMono.variable} ${literata.variable} ${jetbrainsMono.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="flex flex-col min-h-screen bg-background text-foreground font-sans antialiased">
        {/* Material Symbols Outlined (Techno-Occult v2 iconography). Loaded as
            an explicit link because icon fonts aren't served by next/font and
            a CSS @import would land mid-bundle and be ignored.
            Subset via icon_names (alphabetical) — the unsubsetted variable font
            is ~4MB render-blocking on every page. When adding a NEW icon to the
            app, append its name here or it will render as raw ligature text. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=account_balance_wallet,account_circle,account_tree,add,add_circle,adjust,air,all_inclusive,analytics,architecture,arrow_back,arrow_forward,arrow_right_alt,auto_awesome,auto_awesome_mosaic,auto_fix_high,auto_stories,balance,biotech,blur_on,bolt,build_circle,calendar_month,calendar_today,change_history,chat_bubble,check,check_circle,chevron_right,clear_day,close,code,collections_bookmark,construction,crisis_alert,cruelty_free,cyclone,dark_mode,data_object,data_usage,description,diamond,done_all,downloading,ecg_heart,emergency,error,expand_more,explore,favorite,filter_4,filter_center_focus,filter_vintage,flare,forum,functions,gallery_thumbnail,gavel,grain,graphic_eq,group_work,help,hexagon,history,history_edu,hourglass_empty,hub,inventory_2,landscape,language,link,local_fire_department,lock,lock_open,magic_button,memory,menu,menu_book,monitoring,my_location,notifications,person,policy,power_off,psychology,psychology_alt,public,redeem,reply,schedule,science,search,send,settings,shield,skillet,speed,stars,stream,swap_horiz,swords,sync,target,timeline,toll,trending_up,verified,visibility,volunteer_activism,warning,water_drop,waves,wb_sunny,workspace_premium&display=swap"
        />
        <Providers>
          <RootChrome>{children}</RootChrome>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
