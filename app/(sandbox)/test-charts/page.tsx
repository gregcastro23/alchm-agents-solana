// Test page for chart visualization
import CircularNatalHoroscope from '@/components/charts/circular-natal-horoscope'

export default function TestChartsPage() {
  const testBirthInfo = {
    name: 'Test Subject',
    year: 1990,
    month: 0, // January
    day: 15,
    hour: 12,
    minute: 0,
    latitude: 40.7128,
    longitude: -74.006,
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Chart Visualization Test</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Birth Chart Test */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Birth Chart Test</h2>
          <CircularNatalHoroscope birthInfo={testBirthInfo} className="w-full" />
        </div>

        {/* Current Moment Chart Test */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Current Moment Chart Test</h2>
          <CircularNatalHoroscope className="w-full" />
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Test Status</h3>
        <p className="text-sm text-muted-foreground">
          If you see charts above with zodiac symbols, planets, and aspects, the chart visualization
          fix is working correctly! The charts should display even when external services are
          unavailable thanks to our local SVG generation fallback.
        </p>
      </div>
    </div>
  )
}
