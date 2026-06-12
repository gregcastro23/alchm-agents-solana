import { MoonPhaseAgentChat } from '@/components/misc/moon-phase-agent-chat'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MOON_PHASES, ZODIAC_SIGNS } from '@/lib/moon-phase-system'

export default function MoonPhasesPage() {
  const totalAgents = Object.values(MOON_PHASES).length * ZODIAC_SIGNS.length * 30

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Moon Phase Oracle System</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Experience the Moon&apos;s wisdom through {Object.values(MOON_PHASES).length} distinct
          phases, each expressing uniquely through the 12 zodiac signs at every degree
        </p>
        <div className="flex justify-center gap-4">
          <Badge variant="outline" className="text-lg py-2 px-4">
            {Object.values(MOON_PHASES).length} Moon Phases
          </Badge>
          <Badge variant="outline" className="text-lg py-2 px-4">
            {ZODIAC_SIGNS.length} Zodiac Signs
          </Badge>
          <Badge variant="outline" className="text-lg py-2 px-4">
            {totalAgents.toLocaleString()} Unique Agents
          </Badge>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Moon Phase Archetypes</CardTitle>
            <CardDescription>
              Each phase carries a unique archetypal energy and spiritual focus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.values(MOON_PHASES).map(phase => (
                <div
                  key={phase.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{phase.emoji}</span>
                    <span className="font-medium">{phase.name}</span>
                  </div>
                  <Badge variant="secondary">
                    {phase.range[0]}° - {phase.range[1]}°
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zodiacal Expressions</CardTitle>
            <CardDescription>
              The Moon expresses differently through each sign&apos;s element and modality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {ZODIAC_SIGNS.map(sign => (
                <div key={sign.name} className="p-2 rounded border text-sm">
                  <div className="font-medium">{sign.name}</div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {sign.element}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {sign.modality}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <MoonPhaseAgentChat className="max-w-4xl mx-auto" />

      <Card>
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
