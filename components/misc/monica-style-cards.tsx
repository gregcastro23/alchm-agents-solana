'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export type StyleCards = {
  practical: boolean
  poetic: boolean
  concise: boolean
  deep: boolean
  beginner: boolean
  advanced: boolean
}

export function MonicaStyleCards({
  value,
  onChange,
}: {
  value: StyleCards
  onChange: (v: StyleCards) => void
}) {
  const [local, setLocal] = useState<StyleCards>(value)
  const toggle = (k: keyof StyleCards) => {
    const next = { ...local, [k]: !local[k] }
    setLocal(next)
    onChange(next)
  }
  const Toggle = ({ k, label }: { k: keyof StyleCards; label: string }) => (
    <Button variant={local[k] ? 'default' : 'outline'} size="sm" onClick={() => toggle(k)}>
      {label}
    </Button>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Style Cards</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Toggle k="practical" label="Practical" />
          <Toggle k="poetic" label="Poetic" />
          <Toggle k="concise" label="Concise" />
          <Toggle k="deep" label="Deep" />
          <Toggle k="beginner" label="Beginner" />
          <Toggle k="advanced" label="Advanced" />
        </div>
      </CardContent>
    </Card>
  )
}
