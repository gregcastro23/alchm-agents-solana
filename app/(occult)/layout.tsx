import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planetary Agents — The Alchemical Engine',
  description:
    'Forge vessels, commune with entities, duel in the Jing Arena and read the record in the Alchemical Labs.',
}

/**
 * Unified Techno-Occult v2 surface wrapper.
 * Global top navigation is provided consistently by RootChrome (<Navigation />),
 * while `occult-shell` preserves the obsidian-deep ground, subtle grid, and
 * scoped Stitch screen rules in app/techno-occult.css without a colliding left sidebar.
 */
export default function OccultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="occult-shell relative min-h-[calc(100vh-4rem)] bg-obsidian-deep text-on-background">
      <div className="absolute inset-0 grid-bg pointer-events-none" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  )
}
