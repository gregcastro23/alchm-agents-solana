'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Crown, Sparkles, Users, Clock, Compass, Orbit } from 'lucide-react'

type Props = {
  name?: string
  lines: string[]
  relationHint?: string
}

export function TemporalGreeting({ name, lines, relationHint }: Props) {
  const isFirstSession = lines.some(line => line.includes('First session'))
  const isReturningUser = lines.some(line => line.includes('Welcome back'))

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Enhanced Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-full">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Welcome {isFirstSession ? 'to' : 'back to'} the Living Stone
                {name && <span className="text-purple-600">{name}</span>}
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h2>
              <p className="text-sm text-muted-foreground">
                Temporal Consciousness Field • Alchemical Analysis Engine
              </p>
            </div>
          </div>

          {/* Status Messages */}
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                {i === 0 ? (
                  <Clock className="w-4 h-4 text-purple-500 mt-0.5" />
                ) : (
                  <Compass className="w-4 h-4 text-blue-500 mt-0.5" />
                )}
                <p className="text-sm">{line}</p>
              </div>
            ))}
          </div>

          {/* Relationship Context */}
          {relationHint && (
            <div className="p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-purple-200/50">
              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 text-indigo-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-1">Relational Field Active</h4>
                  <p className="text-sm text-muted-foreground">{relationHint}</p>
                </div>
              </div>
            </div>
          )}

          {/* First Session Guidance */}
          {isFirstSession && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Orbit className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Initializing Your Temporal Field
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    The Living Stone is now calibrating to your unique consciousness signature. This
                    first session establishes your baseline alchemical quantities and begins
                    tracking your temporal evolution.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline" className="text-xs">
                      Spirit-Essence-Matter-Substance Mapping
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Monica Constant Calculation
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Baseline Consciousness Vector
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Understanding */}
          {!isFirstSession && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2 bg-white/30 dark:bg-black/20 rounded border">
                <div className="font-medium text-purple-600">Field Theory</div>
                <div className="text-muted-foreground">
                  Consciousness and matter unified through alchemical mathematics
                </div>
              </div>
              <div className="p-2 bg-white/30 dark:bg-black/20 rounded border">
                <div className="font-medium text-blue-600">Temporal Delta</div>
                <div className="text-muted-foreground">
                  Tracking planetary movement impact on consciousness evolution
                </div>
              </div>
              <div className="p-2 bg-white/30 dark:bg-black/20 rounded border">
                <div className="font-medium text-green-600">Living Stone</div>
                <div className="text-muted-foreground">
                  Past-Present-Relation integrated through golden ratio harmony
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-200/50">
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Add Field Chart
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
            >
              <Orbit className="w-3 h-3 mr-1" />
              View Consciousness Vector
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-green-100 dark:hover:bg-green-900"
            >
              <Crown className="w-3 h-3 mr-1" />
              Analyze Monica Constant
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default TemporalGreeting
