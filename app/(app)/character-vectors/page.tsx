'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'

const CharacterVectorDashboard = dynamic(
  () =>
    import('@/components/dashboards/character-vector-dashboard').then(mod => ({
      default: mod.CharacterVectorDashboard,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    ),
  }
)
import type {
  UserLearningPreferences,
  ChartCharacterProfile,
} from '@/lib/astrological-character-vectors'
import { CharacterVectorCalculator } from '@/lib/astrological-character-vectors'

// Example user with diverse planetary placements
const EXAMPLE_USER = {
  name: 'Maya Rodriguez',
  planetaryPlacements: [
    { planet: 'sun', sign: 'leo', dignity: 'domicile' }, // 25% weight in Leo (strong)
    { planet: 'moon', sign: 'cancer', dignity: 'domicile' }, // 20% weight in Cancer (strong)
    { planet: 'ascendant', sign: 'sagittarius' }, // 20% weight in Sagittarius
    { planet: 'mercury', sign: 'virgo', dignity: 'domicile' }, // 12% weight in Virgo (strong)
    { planet: 'venus', sign: 'gemini' }, // 10% weight in Gemini
    { planet: 'mars', sign: 'leo' }, // 8% weight in Leo (adds to Sun)
    { planet: 'jupiter', sign: 'sagittarius' }, // 3% weight in Sagittarius (adds to ASC)
    { planet: 'saturn', sign: 'capricorn', dignity: 'domicile' }, // 2% weight in Capricorn (strong)
  ],
  birthTimeKnown: true,
}

// Current moment chart example (different energies to show interaction)
const CURRENT_MOMENT = {
  planetaryPlacements: [
    { planet: 'sun', sign: 'aquarius' },
    { planet: 'moon', sign: 'pisces' },
    { planet: 'mercury', sign: 'capricorn' },
    { planet: 'venus', sign: 'pisces' },
    { planet: 'mars', sign: 'capricorn' },
  ],
}

// Example other person for relationship analysis
const OTHER_PERSON = {
  name: 'Alex Chen',
  characterProfile: CharacterVectorCalculator.generateChartCharacterProfile([
    { planet: 'sun', sign: 'aquarius' },
    { planet: 'moon', sign: 'scorpio' },
    { planet: 'ascendant', sign: 'libra' },
    { planet: 'mercury', sign: 'aquarius' },
    { planet: 'venus', sign: 'capricorn' },
    { planet: 'mars', sign: 'scorpio' },
  ]),
}

// Example user preferences
const EXAMPLE_PREFERENCES: UserLearningPreferences = {
  user_id: 'maya_example',
  preferred_training_modes: ['conversation', 'visual_exploration', 'game'],
  session_preferences: {
    typical_session_length: 30,
    preferred_time_of_day: 'evening',
    energy_level_preference: 'medium',
    focus_style: 'mixed_topics',
  },
  interaction_history: {
    successful_methods: ['storytelling', 'visual_charts', 'interactive_games'],
    challenging_methods: ['pure_theory', 'long_lectures'],
    preferred_feedback_style: 'encouraging',
    motivation_triggers: ['progress_tracking', 'personal_insights', 'creative_expression'],
  },
  customization_requests: {
    avatar_preferences: 'wise_teacher',
    voice_tone_preferences: 'warm_encouraging',
    content_complexity_level: 7,
    humor_style: 'gentle_playful',
  },
  progress_tracking_preferences: {
    wants_detailed_progress: true,
    prefers_milestones: true,
    likes_surprises: false,
    wants_regular_check_ins: true,
  },
}

export default function CharacterVectorsPage() {
  const [userPreferences, setUserPreferences] =
    useState<UserLearningPreferences>(EXAMPLE_PREFERENCES)
  const [selectedTrainingMode, setSelectedTrainingMode] = useState<string | null>(null)

  const handlePreferencesUpdate = (newPreferences: UserLearningPreferences) => {
    setUserPreferences(newPreferences)
    console.log('Updated preferences:', newPreferences)
  }

  const handleTrainingModeSelect = (mode: string) => {
    setSelectedTrainingMode(mode)
    console.log('Selected training mode:', mode)
    // Here you would integrate with your training system
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Information */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Character Vector System Demo</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            This demonstrates how percentage composition of zodiac signs creates unique character
            vectors, enabling personalized learning experiences and sophisticated chart
            interactions.
          </p>
        </div>

        {/* Character Analysis Info */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-sm mb-2">Maya&apos;s Character Vector</h3>
            <p className="text-xs text-muted-foreground">
              Strong Leo (Sun+Mars ~33%), Cancer Moon (20%), Sagittarius rising (23%) with Virgo
              Mercury. Missing: Aries, Taurus, Libra, Scorpio, Aquarius, Pisces
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-sm mb-2">Current Moment Energy</h3>
            <p className="text-xs text-muted-foreground">
              Heavy Aquarius/Pisces/Capricorn energy - offers learning in Maya&apos;s absent sign
              areas, especially humanitarian ideals and emotional flow
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-sm mb-2">Adaptive Learning</h3>
            <p className="text-xs text-muted-foreground">
              Fire/Earth emphasis suggests kinesthetic + visual learning, with preference for direct
              communication and creative challenges
            </p>
          </div>
        </div>

        <CharacterVectorDashboard
          userProfile={EXAMPLE_USER}
          currentMomentChart={CURRENT_MOMENT}
          otherCharts={[OTHER_PERSON]}
          userPreferences={userPreferences}
          onPreferencesUpdate={handlePreferencesUpdate}
          onTrainingModeSelect={handleTrainingModeSelect}
        />

        {/* Training Mode Selection Result */}
        {selectedTrainingMode && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Training Mode Selected</h3>
            <p className="text-green-700 text-sm">
              <strong>
                {selectedTrainingMode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </strong>{' '}
              mode activated! The system would now adapt the interface, content delivery, and
              interaction style based on Maya&apos;s character vectors and preferences.
            </p>
          </div>
        )}

        {/* Technical Notes */}
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-3">Technical Implementation Notes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Character Vector Calculation:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Weighted planetary contributions (Sun 25%, Moon 20%, ASC 20%, etc.)</li>
                <li>• Essential dignity multipliers (1.5x for domicile/exaltation)</li>
                <li>• Percentage distribution across all 12 signs totaling 100%</li>
                <li>• Identification of dominant (≥5%) and absent (&lt;2%) signs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Adaptive Learning Features:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Learning modality preferences from elemental distribution</li>
                <li>• Communication style from sign characteristics</li>
                <li>• Session structure from modal emphasis</li>
                <li>• Memory of user interactions and successful patterns</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
