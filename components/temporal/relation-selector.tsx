'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LocationSearch, type LocationData } from '@/components/onboarding/LocationSearch'

export type RelationChart = {
  name: string
  birthDate: string
  birthTime?: string
  latitude?: string
  longitude?: string
  locationName?: string
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
  const [locationName, setLocationName] = useState('')

  const handleAdd = () => {
    if (name && birthDate) {
      onAddRelation({
        name,
        birthDate,
        birthTime: birthTime || undefined,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        locationName: locationName || undefined,
      })
      setName('')
      setBirthDate('')
      setBirthTime('')
      setLatitude('')
      setLongitude('')
      setLocationName('')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Chart to Field</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <LocationSearch
              label="Birth Location (optional)"
              defaultValue={locationName}
              defaultLatitude={latitude ? parseFloat(latitude) : undefined}
              defaultLongitude={longitude ? parseFloat(longitude) : undefined}
              onLocationSelect={(loc: LocationData) => {
                setLatitude(String(loc.latitude))
                setLongitude(String(loc.longitude))
                setLocationName(loc.displayName)
              }}
              placeholder="Search birth city (e.g. Chicago, IL)..."
              required={false}
              compact
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
                  {rel.birthTime ? ` ${rel.birthTime}` : ''}
                  {rel.locationName ? ` · ${rel.locationName}` : ''})
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
