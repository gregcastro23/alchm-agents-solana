'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { GeocodeResult } from '@/lib/services/geocoding-service'

export interface LocationData {
  displayName: string
  latitude: number
  longitude: number
  city?: string
  state?: string
  country?: string
  timezone?: string
}

interface LocationSearchProps {
  onLocationSelect: (location: LocationData) => void
  defaultValue?: string
  defaultLatitude?: number
  defaultLongitude?: number
  /** Compact mode for inline forms */
  compact?: boolean
  /** Show coordinates badge below input */
  showCoordinates?: boolean
  /** Custom label */
  label?: string
  /** Placeholder text */
  placeholder?: string
  /** Required field indicator */
  required?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Optional custom container class */
  className?: string
}

/**
 * Location Search Component
 * Autocompletes birth city/place and seamlessly resolves latitude/longitude.
 */
export function LocationSearch({
  onLocationSelect,
  defaultValue = '',
  defaultLatitude,
  defaultLongitude,
  compact = false,
  showCoordinates = true,
  label = 'Birth Location',
  placeholder = 'Search birth city (e.g. Chicago, IL, London, Tokyo)...',
  required = true,
  disabled = false,
  className = '',
}: LocationSearchProps) {
  const [query, setQuery] = useState(defaultValue)
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    defaultLatitude !== undefined && defaultLongitude !== undefined && defaultValue
      ? {
          displayName: defaultValue,
          latitude: defaultLatitude,
          longitude: defaultLongitude,
        }
      : null
  )
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle click outside to close results dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync defaultValue if updated externally
  useEffect(() => {
    if (defaultValue && !selectedLocation) {
      setQuery(defaultValue)
      if (defaultLatitude !== undefined && defaultLongitude !== undefined) {
        setSelectedLocation({
          displayName: defaultValue,
          latitude: defaultLatitude,
          longitude: defaultLongitude,
        })
      }
    }
  }, [defaultValue, defaultLatitude, defaultLongitude, selectedLocation])

  // Debounced geocoding search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([])
      setShowResults(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/geocoding?q=${encodeURIComponent(searchQuery.trim())}`)
      if (!response.ok) throw new Error(`Geocoding error: ${response.status}`)
      const data = await response.json()

      if (data.success && Array.isArray(data.results)) {
        setResults(data.results)
        setShowResults(data.results.length > 0)
      }
    } catch (error) {
      console.error('[LocationSearch] Search failed:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Don't re-search if query matches the already selected location
    if (selectedLocation && query === selectedLocation.displayName) {
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      void performSearch(query)
    }, 350)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query, performSearch, selectedLocation])

  const handleSelectLocation = (result: GeocodeResult) => {
    const loc: LocationData = {
      displayName: result.displayName || result.formattedName,
      latitude: result.latitude,
      longitude: result.longitude,
      city: result.city,
      state: result.state,
      country: result.country,
      timezone: result.timezone,
    }

    setQuery(loc.displayName)
    setSelectedLocation(loc)
    setShowResults(false)
    onLocationSelect(loc)
  }

  const handleClear = () => {
    setQuery('')
    setSelectedLocation(null)
    setResults([])
    setShowResults(false)
  }

  const formatCoordDisplay = (lat: number, lon: number) => {
    const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`
    const lonStr = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`
    return `${latStr}, ${lonStr}`
  }

  const inputClasses = compact
    ? 'w-full bg-black/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 pr-8'
    : 'w-full px-4 py-3 bg-black/40 border border-purple-500/40 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-400/40 transition-all outline-none text-zinc-100 placeholder:text-zinc-500 pr-10'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {!compact && label && (
        <label
          htmlFor="birth-location-input"
          className="block text-sm font-medium text-purple-200 mb-1.5"
        >
          {label}
          {required && <span className="text-purple-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id="birth-location-input"
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            if (selectedLocation) setSelectedLocation(null)
          }}
          onFocus={() => {
            if (results.length > 0 && !selectedLocation) setShowResults(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
          required={required}
          autoComplete="off"
        />

        {/* Clear icon button */}
        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            tabIndex={-1}
            aria-label="Clear location"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Search Icon */}
        {!query && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400/60 pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#0e0d17] border border-purple-500/40 rounded-xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur-md">
          {results.length > 0 ? (
            results.map((result, idx) => {
              const primary = result.primary || result.displayName || result.formattedName
              const secondary = result.secondary || result.country || ''

              return (
                <button
                  key={`${result.latitude}-${result.longitude}-${idx}`}
                  type="button"
                  onClick={() => handleSelectLocation(result)}
                  className="w-full px-4 py-2.5 text-left hover:bg-purple-900/30 transition-colors border-b border-purple-500/10 last:border-b-0 group flex items-start gap-2.5"
                >
                  <svg
                    className="w-4 h-4 mt-1 text-purple-400/70 group-hover:text-purple-300 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100 text-sm truncate group-hover:text-purple-200">
                      {primary}
                    </div>
                    {secondary && (
                      <div className="text-xs text-zinc-400 truncate mt-0.5">{secondary}</div>
                    )}
                    <div className="text-[10px] font-mono text-purple-400/70 mt-0.5">
                      {formatCoordDisplay(result.latitude, result.longitude)}
                      {result.type && (
                        <span className="ml-2 px-1 py-0.2 bg-purple-950/60 border border-purple-500/20 rounded capitalize text-[9px] text-purple-300">
                          {result.type}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="px-4 py-3 text-zinc-400 text-sm">
              No matching locations found. Try entering city and state/country.
            </div>
          )}
        </div>
      )}

      {/* Selected Coordinates Confirmation Pill */}
      {selectedLocation && showCoordinates && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/40 text-purple-200 font-mono">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>{formatCoordDisplay(selectedLocation.latitude, selectedLocation.longitude)}</span>
          </span>
          <span className="text-zinc-400 text-[11px]">Auto-derived coordinates</span>
        </div>
      )}
    </div>
  )
}
export default LocationSearch
