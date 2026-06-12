/**
 * Zodiac Calendar API
 * ===================
 *
 * Provides precise zodiac degree to calendar date mappings
 * with high accuracy astronomical calculations
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateSolarPosition,
  getZodiacPositionForDate,
  getDatesForZodiacDegree,
  getZodiacIngresses,
  getCardinalPoints,
  getSignDurations,
  ZodiacPosition,
  DateRange,
} from '@/lib/ephemeris/solar-ephemeris'
import {
  buildAnnualCalendar,
  getDegreeForDate,
  findDatesForDegree,
  getCurrentZodiacPeriod,
  daysUntilNextIngress,
  getMonthlyZodiacCalendar,
} from '@/lib/ephemeris/degree-calendar-map'

// GET /api/zodiac-calendar
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'degree-for-date': {
        // Get exact zodiac degree for a specific date
        const dateStr = searchParams.get('date')
        if (!dateStr) {
          return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
        }

        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
        }

        const zodiacPos = getZodiacPositionForDate(date)
        const degreeInfo = getDegreeForDate(date)
        const solar = calculateSolarPosition(date)

        return NextResponse.json({
          date: date.toISOString(),
          zodiac: zodiacPos,
          degreeInfo,
          solar: {
            longitude: solar.longitude,
            distance: solar.distance,
            speed: solar.speed,
            equation_of_time: solar.equation_of_time,
            declination: solar.declination,
          },
        })
      }

      case 'dates-for-degree': {
        // Get date ranges when Sun is at a specific degree
        const degreeStr = searchParams.get('degree')
        const yearStr = searchParams.get('year') || new Date().getFullYear().toString()

        if (!degreeStr) {
          return NextResponse.json({ error: 'Degree parameter is required' }, { status: 400 })
        }

        const degree = parseFloat(degreeStr)
        const year = parseInt(yearStr)

        if (isNaN(degree) || degree < 0 || degree >= 360) {
          return NextResponse.json({ error: 'Degree must be between 0 and 359' }, { status: 400 })
        }

        const dates = getDatesForZodiacDegree(year, degree)
        const signIndex = Math.floor(degree / 30)
        const signDegree = degree % 30
        const signs = [
          'Aries',
          'Taurus',
          'Gemini',
          'Cancer',
          'Leo',
          'Virgo',
          'Libra',
          'Scorpio',
          'Sagittarius',
          'Capricorn',
          'Aquarius',
          'Pisces',
        ]

        return NextResponse.json({
          degree,
          year,
          sign: signs[signIndex],
          signDegree,
          dateRange: dates,
          description: `Sun at ${degree}° (${Math.floor(signDegree)}° ${signs[signIndex]})`,
        })
      }

      case 'year-map': {
        // Get complete year mapping
        const yearStr = searchParams.get('year') || new Date().getFullYear().toString()
        const year = parseInt(yearStr)

        const calendar = buildAnnualCalendar(year)
        const ingresses = getZodiacIngresses(year)
        const cardinals = getCardinalPoints(year)
        const durations = getSignDurations(year)

        // Convert Map to array for JSON serialization
        const degreeArray = Array.from(calendar.degreeMap.entries()).map(([mapDegree, entry]) => ({
          ...entry,
          degree: mapDegree,
        }))

        return NextResponse.json({
          year,
          equinoxes_solstices: {
            spring_equinox: cardinals.spring_equinox,
            summer_solstice: cardinals.summer_solstice,
            autumn_equinox: cardinals.autumn_equinox,
            winter_solstice: cardinals.winter_solstice,
          },
          sign_ingresses: ingresses,
          sign_durations: durations,
          sign_periods: calendar.signPeriods,
          total_degrees: degreeArray.length,
          sample_degrees: degreeArray.filter(d => d.degree % 30 === 0), // Just cardinal degrees for preview
        })
      }

      case 'current-period': {
        // Get current zodiac period information
        const period = getCurrentZodiacPeriod()
        const nextIngress = daysUntilNextIngress()
        const now = new Date()
        const zodiacPos = getZodiacPositionForDate(now)

        return NextResponse.json({
          current_time: now.toISOString(),
          zodiac_position: zodiacPos,
          current_period: period,
          next_ingress: nextIngress,
          current_decan: zodiacPos.decan,
          decan_ruler: zodiacPos.decan_ruler,
        })
      }

      case 'monthly-calendar': {
        // Get monthly zodiac calendar
        const yearStr = searchParams.get('year') || new Date().getFullYear().toString()
        const monthStr = searchParams.get('month') || (new Date().getMonth() + 1).toString()

        const year = parseInt(yearStr)
        const month = parseInt(monthStr)

        if (month < 1 || month > 12) {
          return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 })
        }

        const monthCalendar = getMonthlyZodiacCalendar(year, month)

        return NextResponse.json({
          year,
          month: monthCalendar.month,
          days: monthCalendar.days,
          ingress_days: monthCalendar.days.filter(d => d.isIngress),
          cardinal_days: monthCalendar.days.filter(d => d.isCardinal),
        })
      }

      case 'compare-accuracy': {
        // Compare old vs new calculation accuracy
        const dateStr = searchParams.get('date')
        if (!dateStr) {
          return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 })
        }

        const date = new Date(dateStr)

        // New precise calculation
        const precisePos = getZodiacPositionForDate(date)
        const preciseSolar = calculateSolarPosition(date)

        // Old simplified calculation (mimicking the old logic)
        const dayOfYear = Math.floor(
          (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
        )
        const oldSignIndex = Math.floor(((dayOfYear + 80) % 365) / 30) % 12
        const oldDegree = Math.floor((dayOfYear % 30) * 1.2) % 30
        const signs = [
          'Aries',
          'Taurus',
          'Gemini',
          'Cancer',
          'Leo',
          'Virgo',
          'Libra',
          'Scorpio',
          'Sagittarius',
          'Capricorn',
          'Aquarius',
          'Pisces',
        ]

        const difference = Math.abs(precisePos.absolute_longitude - (oldSignIndex * 30 + oldDegree))

        return NextResponse.json({
          date: date.toISOString(),
          old_calculation: {
            sign: signs[oldSignIndex],
            degree: oldDegree,
            absolute: oldSignIndex * 30 + oldDegree,
            method: 'simplified day-of-year division',
          },
          new_calculation: {
            sign: precisePos.sign,
            degree: precisePos.degree_in_sign,
            absolute: precisePos.absolute_longitude,
            method: 'VSOP87 astronomical calculation',
          },
          accuracy_improvement: {
            degree_difference: difference,
            improvement_factor: difference > 0 ? (difference / 5).toFixed(2) + 'x' : 'exact',
            sun_distance: preciseSolar.distance + ' AU',
            sun_speed: preciseSolar.speed.toFixed(4) + '°/day',
            equation_of_time: preciseSolar.equation_of_time.toFixed(2) + ' minutes',
          },
        })
      }

      default: {
        // Return available endpoints
        return NextResponse.json({
          available_actions: [
            'degree-for-date',
            'dates-for-degree',
            'year-map',
            'current-period',
            'monthly-calendar',
            'compare-accuracy',
          ],
          examples: {
            degree_for_date: '/api/zodiac-calendar?action=degree-for-date&date=2025-09-21',
            dates_for_degree: '/api/zodiac-calendar?action=dates-for-degree&degree=180&year=2025',
            year_map: '/api/zodiac-calendar?action=year-map&year=2025',
            current_period: '/api/zodiac-calendar?action=current-period',
            monthly_calendar: '/api/zodiac-calendar?action=monthly-calendar&year=2025&month=3',
            compare_accuracy: '/api/zodiac-calendar?action=compare-accuracy&date=2025-09-21',
          },
        })
      }
    }
  } catch (error) {
    console.error('Zodiac calendar API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
