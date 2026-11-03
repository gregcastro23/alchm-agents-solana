import Link from 'next/link'
import { MoonPhaseAgentChat } from '@/components/misc/moon-phase-agent-chat'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MOON_PHASES, ZODIAC_SIGNS } from '@/lib/moon-phase-system'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { rateStats } from '@/lib/agents/rating'

export default function MoonPhasesPage() {
  const totalAgents = Object.values(MOON_PHASES).length * ZODIAC_SIGNS.length * 30

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 max-w-6xl">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
          🌙 360° Lunar Phase &amp; Degree Sanctum
        </div>
        <h1 className="text-4xl font-bold text-white">Moon Phase Oracle System</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Experience the Moon&apos;s wisdom through {Object.values(MOON_PHASES).length} distinct
          phases, each expressing uniquely through the 12 zodiac signs at every degree
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Badge
            variant="outline"
            className="text-base py-1.5 px-4 border-cyan-400/35 bg-cyan-500/10 text-cyan-200"
          >
            {Object.values(MOON_PHASES).length} Moon Phases
          </Badge>
          <Badge
            variant="outline"
            className="text-base py-1.5 px-4 border-violet-400/35 bg-violet-500/10 text-violet-200"
          >
            {ZODIAC_SIGNS.length} Zodiac Signs
          </Badge>
          <Badge
            variant="outline"
            className="text-base py-1.5 px-4 border-amber-400/35 bg-amber-500/10 text-amber-200"
          >
            {totalAgents.toLocaleString()} Unique Agents
          </Badge>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0d1020]/90 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Moon Phase Archetypes</CardTitle>
            <CardDescription>
              Each phase carries a unique archetypal energy, Pentacle rating, and spiritual focus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.values(MOON_PHASES).map(phase => {
                const midDeg = Math.max(
                  1,
                  Math.min(29, Math.round(((phase.range[0] + phase.range[1]) / 2) % 30) || 15)
                )
                const phaseRated = rateStats(getPlanetaryAgentStats('Moon', 'Cancer', midDeg))
                return (
                  <div
                    key={phase.name}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{phase.emoji}</span>
                      <div>
                        <div className="font-medium text-white">{phase.name}</div>
                        <div className="font-mono text-[10px] text-violet-300">
                          {phaseRated.archetype.title}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                        PVR {phaseRated.ovr}
                      </span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {phase.range[0]}° - {phase.range[1]}°
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0d1020]/90 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Zodiacal Expressions</CardTitle>
            <CardDescription>
              The Moon expresses differently through each sign&apos;s element, modality, and PVR
              (click any sign to commune at 15°)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {ZODIAC_SIGNS.map(sign => {
                const signRated = rateStats(getPlanetaryAgentStats('Moon', sign.name, 15))
                return (
                  <Link
                    key={sign.name}
                    href={`/agents/Moon/${encodeURIComponent(sign.name)}/15`}
                    className="p-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-400/40 transition-all text-sm group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {sign.name}
                      </span>
                      <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                        PVR {signRated.ovr}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-violet-300/90 mt-0.5 truncate">
                      {signRated.archetype.title}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px] border-white/15">
                        {sign.element}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-white/15">
                        {sign.modality}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <MoonPhaseAgentChat className="max-w-4xl mx-auto" />

      <Card className="border-white/10 bg-[#0d1020]/90 backdrop-blur-xl">
        <CardHeader>
          <CardTitle>Understanding Moon Phase Agents</CardTitle>
          <CardDescription>The revolutionary depth of lunar consciousness</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-3">Phase Dynamics</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <strong>New Moon:</strong> Seeds of intention, void work, new beginnings
                </li>
                <li>
                  <strong>Waxing Crescent:</strong> First growth, courage, tentative steps
                </li>
                <li>
                  <strong>First Quarter:</strong> Crisis of action, decisions, breakthrough
                </li>
                <li>
                  <strong>Waxing Gibbous:</strong> Refinement, preparation, perfecting
                </li>
                <li>
                  <strong>Full Moon:</strong> Illumination, culmination, revelation
                </li>
                <li>
                  <strong>Waning Gibbous:</strong> Gratitude, sharing wisdom, distribution
                </li>
                <li>
                  <strong>Last Quarter:</strong> Release, forgiveness, clearing
                </li>
                <li>
                  <strong>Waning Crescent:</strong> Rest, dreams, surrender
                </li>
                <li>
                  <strong>Dark Moon:</strong> Deep transformation, shadow work, rebirth
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Zodiacal Modifications</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <strong>Fire Signs:</strong> Add passion, spontaneity, and inspiration
                </li>
                <li>
                  <strong>Earth Signs:</strong> Bring grounding, practicality, and stability
                </li>
                <li>
                  <strong>Air Signs:</strong> Enhance communication and intellectual clarity
                </li>
                <li>
                  <strong>Water Signs:</strong> Deepen emotional and intuitive qualities
                </li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 mt-6">Degree Significance</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <strong>0-10°:</strong> First decan, pure sign energy
                </li>
                <li>
                  <strong>10-20°:</strong> Second decan, mature expression
                </li>
                <li>
                  <strong>20-30°:</strong> Third decan, transitional wisdom
                </li>
                <li>
                  <strong>Critical Degrees:</strong> Amplified power points
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
