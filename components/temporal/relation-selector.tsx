'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type RelationChart = {
  name: string
  birthDate: string
  birthTime?: string
  latitude?: string
  longitude?: string
}

type Props = {
  onAddRelation: (relation: RelationChart) => void
  relations: RelationChart[]
  onRemoveRelation: (index: number) => void
}

export function RelationSelector({ onAddRelation, relations, onRemoveRelation }: Props) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const handleAdd = () => {
    if (name && birthDate) {
      onAddRelation({
        name,
        birthDate,
        birthTime: birthTime || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      })
      setName('')
      setBirthDate('')
      setBirthTime('')
      setLatitude('')
      setLongitude('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Chart to Field</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Brother"
            />
          </div>
          <div>
            <Label htmlFor="birthDate">Birth Date</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="birthTime">Birth Time (optional)</Label>
            <Input
              id="birthTime"
              type="time"
              value={birthTime}
              onChange={e => setBirthTime(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="latitude">Latitude (optional)</Label>
            <Input
              id="latitude"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              placeholder="e.g., 34.0522"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude (optional)</Label>
            <Input
              id="longitude"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              placeholder="e.g., -118.2437"
            />
          </div>
        </div>
        <Button onClick={handleAdd} disabled={!name || !birthDate}>
          Add Chart
        </Button>

        {relations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Charts in Field:</h4>
            {relations.map((rel, i) => (
              <div key={i} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">
                  {rel.name} ({rel.birthDate}
                  {rel.birthTime ? ` ${rel.birthTime}` : ''})
                </span>
                <Button variant="ghost" size="sm" onClick={() => onRemoveRelation(i)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default RelationSelector
