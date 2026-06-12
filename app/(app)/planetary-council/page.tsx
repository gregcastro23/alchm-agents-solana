'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import PlanetaryWisdomChat from '@/components/misc/planetary-wisdom-chat'

export default function PlanetaryCouncilPage() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c0319] via-[#1a0838] to-[#0c0319] text-white relative">
      {/* Starfield Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(2px 2px at 15% 25%, rgba(255, 255, 255, 0.7), transparent), radial-gradient(1.5px 1.5px at 78% 12%, rgba(167, 139, 250, 0.8), transparent), radial-gradient(1px 1px at 35% 68%, rgba(255, 255, 255, 0.6), transparent)',
          backgroundSize: '500px 500px, 400px 400px, 300px 300px',
        }}
      />

      <div className="container relative z-10 mx-auto py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <MessageSquare className="w-8 h-8 text-purple-500" />
            Planetary Council Chamber
          </h1>
          <p className="text-lg text-purple-200/70 max-w-2xl mx-auto">
            Convene a council of planetary agents to receive multifaceted wisdom. Each planet brings
            its unique perspective, creating a symphony of cosmic guidance.
          </p>
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg inline-block backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <p className="text-sm text-blue-200">
              🌙 <strong className="text-blue-100">Enhanced Moon Agent:</strong> The Moon agent now
              includes degree-specific personality traits based on current lunar phase and position
              for more nuanced guidance.
            </p>
          </div>
          <div className="mt-3 text-xs text-purple-300/60">
            Tip: The council auto-syncs to the current sky by default. You can toggle sync in the
            panel.
          </div>

          {!isOpen && (
            <div className="mt-4">
              <Button onClick={() => setIsOpen(true)} size="lg">
                <MessageSquare className="w-5 h-5 mr-2" />
                Open Planetary Council
              </Button>
            </div>
          )}
        </div>

        <PlanetaryWisdomChat
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          defaultActivePlanets={['Sun', 'Moon', 'Mercury']}
          enableAutoSync={true}
          syncInterval={60000}
          showCurrentSkyChart={true}
          enableTransitAlerts={true}
          planetaryHourNotifications={true}
          title="Planetary Council Chamber"
          maxAgents={7}
          allowMonica={true}
        />

        <div className="mt-12 max-w-3xl mx-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-lg p-6 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)]">
            <h2 className="text-xl font-semibold mb-3 text-white">
              How the Planetary Council Works
            </h2>
            <ul className="space-y-2 text-sm text-purple-200/70">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Select up to 5 planetary agents to form your council</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Configure each planet's zodiacal position for personalized responses</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Each agent responds from their unique planetary perspective</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Planets in strong dignity positions speak with greater authority</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Responses incorporate current alchemical energies (A-Number)</span>
              </li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-black/40 backdrop-blur-md rounded-lg p-5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)] hover:border-purple-500/30 transition-colors">
              <h3 className="font-semibold mb-2 text-white">Beneficial Combinations</h3>
              <ul className="text-sm space-y-1 text-purple-200/70">
                <li>
                  <span className="text-amber-400">☉ Sun</span> +{' '}
                  <span className="text-gray-300">☽ Moon</span>: Balance of conscious and
                  unconscious
                </li>
                <li>
                  <span className="text-pink-400">♀ Venus</span> +{' '}
                  <span className="text-red-500">♂ Mars</span>: Harmony and action in relationships
                </li>
                <li>
                  <span className="text-orange-400">☿ Mercury</span> +{' '}
                  <span className="text-blue-400">♃ Jupiter</span>: Communication and wisdom
                </li>
                <li>
                  <span className="text-purple-400">♄ Saturn</span> +{' '}
                  <span className="text-cyan-400">♅ Uranus</span>: Structure meets innovation
                </li>
              </ul>
            </div>

            <div className="bg-black/40 backdrop-blur-md rounded-lg p-5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.05)] hover:border-purple-500/30 transition-colors">
              <h3 className="font-semibold mb-2 text-white">Council Dynamics</h3>
              <ul className="text-sm space-y-1 text-purple-200/70">
                <li>Planets in domicile speak with natural authority</li>
                <li>Exalted planets offer elevated perspectives</li>
                <li>Planets in fall provide lessons through challenges</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
