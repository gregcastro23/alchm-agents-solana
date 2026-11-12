import { computeTimezoneMetadata, geocodeLocation } from '@/lib/services/geocoding-service'

export interface ResolveRectificationCoordinatesInput {
  year?: number
  month?: number
  day?: number
  location?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ResolvedRectificationCoordinates {
  latitude: number
  longitude: number
  locationName?: string
  timezone?: string
  utcOffsetHours: number
  lmtOffsetHours: number
  clockToLmtMinutes: number
}

const RAW_COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/

function buildReferenceDate(year?: number, month?: number, day?: number): Date | undefined {
  if (
    typeof year === 'number' &&
    typeof month === 'number' &&
    typeof day === 'number' &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
  ) {
    const d = new Date(0)
    d.setUTCFullYear(year, month - 1, day)
    d.setUTCHours(12, 0, 0, 0)
    return d
  }
  return undefined
}

/**
 * Resolve birth coordinates and timezone/LMT metadata from either explicit
 * latitude/longitude or a human city/location string (e.g. "Chicago, IL").
 */
export async function resolveRectificationCoordinates(
  input: ResolveRectificationCoordinatesInput
): Promise<ResolvedRectificationCoordinates> {
  const hasLat = typeof input.latitude === 'number' && Number.isFinite(input.latitude)
  const hasLon = typeof input.longitude === 'number' && Number.isFinite(input.longitude)
  const trimmedLocation = typeof input.location === 'string' ? input.location.trim() : ''
  const referenceDate = buildReferenceDate(input.year, input.month, input.day)

  if (hasLat && hasLon) {
    const latitude = input.latitude as number
    const longitude = input.longitude as number
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('Latitude must be within [-90, 90] and longitude within [-180, 180].')
    }
    const meta = computeTimezoneMetadata(longitude, undefined, referenceDate)
    return {
      latitude,
      longitude,
      ...(trimmedLocation ? { locationName: trimmedLocation } : {}),
      ...meta,
    }
  }

  if (trimmedLocation) {
    const coordMatch = RAW_COORD_PATTERN.exec(trimmedLocation)
    if (coordMatch) {
      const latitude = Number(coordMatch[1])
      const longitude = Number(coordMatch[2])
      if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      ) {
        const meta = computeTimezoneMetadata(longitude, undefined, referenceDate)
        return {
          latitude,
          longitude,
          locationName: trimmedLocation,
          ...meta,
        }
      }
    }

    const geo = await geocodeLocation(trimmedLocation, referenceDate)
    if (!geo) {
      throw new Error(
        `Could not resolve coordinates for location "${trimmedLocation}". Please provide a recognized city name or explicit latitude and longitude.`
      )
    }

    const meta = computeTimezoneMetadata(geo.longitude, geo.timezone, referenceDate)
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      locationName: geo.formattedName || geo.displayName || trimmedLocation,
      timezone: geo.timezone ?? meta.timezone,
      utcOffsetHours: geo.utcOffsetHours ?? meta.utcOffsetHours,
      lmtOffsetHours: geo.lmtOffsetHours ?? meta.lmtOffsetHours,
      clockToLmtMinutes: geo.clockToLmtMinutes ?? meta.clockToLmtMinutes,
    }
  }

  throw new Error(
    hasLat || hasLon
      ? 'Both latitude and longitude are required when specifying coordinates directly, or provide a location city name.'
      : 'Please provide either a birth location (city/country) or latitude and longitude.'
  )
}
