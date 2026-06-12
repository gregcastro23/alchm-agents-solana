'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonicaStyleCards, type StyleCards } from '@/components/misc/monica-style-cards'

export function CreateAIWizard() {
  const [tone, setTone] = useState<'practical' | 'poetic'>('practical')
  const [depth, setDepth] = useState<'concise' | 'deep'>('concise')
  const [interests, setInterests] = useState<string>('tarot, astrology')
  const [style, setStyle] = useState<StyleCards>({
    practical: true,
    poetic: false,
    concise: true,
    deep: false,
    beginner: true,
    advanced: false,
  })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/personalized-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: {
            tone,
            depth,
            interests: interests
              .split(',')
              .map(s => s.trim())
              .filter(Boolean),
          },
          styleCards: style,
        }),
      })
      const data = await resp.json()
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Create my AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tone === 'practical' ? 'default' : 'outline'}
              onClick={() => setTone('practical')}
            >
              Practical
            </Button>
            <Button
              size="sm"
              variant={tone === 'poetic' ? 'default' : 'outline'}
              onClick={() => setTone('poetic')}
            >
              Poetic
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={depth === 'concise' ? 'default' : 'outline'}
              onClick={() => setDepth('concise')}
            >
              Concise
            </Button>
            <Button
              size="sm"
              variant={depth === 'deep' ? 'default' : 'outline'}
              onClick={() => setDepth('deep')}
            >
              Deep
            </Button>
          </div>
          <div>
            <Input
              placeholder="Interests (comma separated)"
              value={interests}
              onChange={e => setInterests(e.target.value)}
            />
          </div>
          <MonicaStyleCards value={style} onChange={setStyle} />
          <Button onClick={submit} disabled={loading} className="w-full">
            {loading ? 'Creating…' : 'Create my AI'}
          </Button>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your AI Config</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
