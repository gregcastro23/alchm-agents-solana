'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationSearch, type LocationData } from '@/components/onboarding/LocationSearch'

type BirthInfoForm = {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  latitude: number | null
  longitude: number | null
  locationName: string
  name?: string
}

export default function ProfileOnboardingForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState<BirthInfoForm>({
    date: '',
    time: '12:00', // Default to noon
    latitude: null,
    longitude: null,
    locationName: '',
    name: '',
  })

  const onChange = (key: 'date' | 'time' | 'name') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const onLocationSelect = (location: LocationData) => {
    setForm(f => ({
      ...f,
      latitude: location.latitude,
      longitude: location.longitude,
      locationName: location.displayName,
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!form.date || !form.time) {
        throw new Error('Please provide both date and time')
      }

      // Validate date format
      const [y, m, d] = form.date.split('-').map(v => parseInt(v, 10))
      if (
        !y ||
        !m ||
        !d ||
        y < 1900 ||
        y > new Date().getFullYear() ||
        m < 1 ||
        m > 12 ||
        d < 1 ||
        d > 31
      ) {
        throw new Error('Please provide a valid birth date')
      }

      // Validate time format
      const [hh, mm] = form.time.split(':').map(v => parseInt(v, 10))
      if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        throw new Error('Please provide a valid birth time')
      }

      // Validate coordinates auto-derived from location
      if (form.latitude === null || form.longitude === null) {
        throw new Error('Please search and select your birth city/location')
      }

      const lat = form.latitude
      const lng = form.longitude
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('Please select a valid birth location with coordinates')
      }

      const birthInfo = {
        year: y,
        month: m - 1, // zero-based month
        day: d,
        hour: hh,
        minute: mm,
        latitude: lat,
        longitude: lng,
        locationName: form.locationName || 'Unknown Location',
        name: form.name || 'Explorer',
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthInfo, name: form.name }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Server error: ${res.status}`)
      }

      setSuccess(true)
      setTimeout(() => {
        router.refresh()
      }, 1000) // Brief success message before refresh
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border border-purple-500/30 bg-black/60 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-zinc-100">
          Complete your Alchm profile
        </CardTitle>
        <p className="text-sm text-zinc-400">
          Your birth details help us create your personalized alchemical chart and consciousness
          vector.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-purple-200">
              Display Name
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={onChange('name')}
              placeholder="Your name"
              disabled={loading}
              className="bg-black/40 border-purple-500/30 text-zinc-100 placeholder:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-purple-200">
                Birth Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={onChange('date')}
                required
                disabled={loading}
                max={new Date().toISOString().split('T')[0]}
                min="1900-01-01"
                className="bg-black/40 border-purple-500/30 text-zinc-100"
              />
            </div>
            <div>
              <Label htmlFor="time" className="text-purple-200">
                Birth Time *
              </Label>
              <Input
                id="time"
                type="time"
                value={form.time}
                onChange={onChange('time')}
                required
                disabled={loading}
                className="bg-black/40 border-purple-500/30 text-zinc-100"
              />
              <p className="text-xs text-zinc-400 mt-1">
                If unknown, noon (12:00) is used as default
              </p>
            </div>
          </div>

          {/* Seamless Birth Location Search with Auto-Geocoding */}
          <div>
            <LocationSearch
              onLocationSelect={onLocationSelect}
              defaultValue={form.locationName}
              defaultLatitude={form.latitude ?? undefined}
              defaultLongitude={form.longitude ?? undefined}
              placeholder="Search birth city (e.g. Chicago, IL, London, Tokyo)..."
              label="Birth Location (City & State / Country)"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-md">
              ✓ Profile saved successfully! Redirecting...
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || success}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium"
          >
            {loading ? 'Saving…' : success ? 'Saved!' : 'Save and Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
