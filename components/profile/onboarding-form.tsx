'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type BirthInfoForm = {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  latitude: string
  longitude: string
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
    latitude: '40.7128', // NYC coordinates as default
    longitude: '-74.0060',
    name: '',
  })

  const onChange = (key: keyof BirthInfoForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

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

      // Validate coordinates
      const lat = parseFloat(form.latitude || '0')
      const lng = parseFloat(form.longitude || '0')
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error(
          'Please provide valid coordinates (latitude: -90 to 90, longitude: -180 to 180)'
        )
      }

      const birthInfo = {
        year: y,
        month: m - 1, // zero-based month [[memory:3826859]]
        day: d,
        hour: hh,
        minute: mm,
        latitude: lat,
        longitude: lng,
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
    <Card>
      <CardHeader>
        <CardTitle>Complete your Alchm profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your birth details help us create your personalized alchemical chart and consciousness
          vector.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={onChange('name')}
              placeholder="Your name"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Birth Date *</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={onChange('date')}
                required
                disabled={loading}
                max={new Date().toISOString().split('T')[0]}
                min="1900-01-01"
              />
            </div>
            <div>
              <Label htmlFor="time">Birth Time *</Label>
              <Input
                id="time"
                type="time"
                value={form.time}
                onChange={onChange('time')}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If unknown, noon (12:00) is used as default
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                value={form.latitude}
                onChange={onChange('latitude')}
                placeholder="40.7128 (NYC)"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">Range: -90 to 90</p>
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                value={form.longitude}
                onChange={onChange('longitude')}
                placeholder="-74.0060 (NYC)"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">Range: -180 to 180</p>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
              ✓ Profile saved successfully! Redirecting...
            </div>
          )}

          <Button type="submit" disabled={loading || success} className="w-full">
            {loading ? 'Saving…' : success ? 'Saved!' : 'Save and Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
