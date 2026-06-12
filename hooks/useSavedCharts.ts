'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SavedChart {
  id: string
  name: string
  birthDate: string
  birthTime: string
  birthPlace: string
  latitude?: number
  longitude?: number
  chartType: 'birth' | 'current' | 'synastry'
  createdAt: string
  planets: Record<string, { sign: string; degree: number; house: number }>
}

interface UseSavedChartsReturn {
  savedCharts: SavedChart[]
  saveChart: (chart: Omit<SavedChart, 'id' | 'createdAt'>) => boolean
  deleteChart: (id: string) => boolean
  loadChart: (id: string) => SavedChart | null
  updateChart: (id: string, updates: Partial<SavedChart>) => boolean
  exportCharts: () => string
  importCharts: (jsonData: string) => boolean
  clearAllCharts: () => void
  isStorage: boolean
}

const STORAGE_KEY = 'planetary-agents-saved-charts'
const MAX_CHARTS = 10

export function useSavedCharts(): UseSavedChartsReturn {
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([])
  const [isStorage, setIsStorage] = useState(false)

  // Check if localStorage is available
  useEffect(() => {
    try {
      const test = 'localStorage-test'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      setIsStorage(true)
    } catch {
      setIsStorage(false)
      console.warn('localStorage is not available. Charts will not persist between sessions.')
    }
  }, [])

  // Load charts from localStorage on mount
  useEffect(() => {
    if (!isStorage) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const charts = JSON.parse(stored) as SavedChart[]
        setSavedCharts(charts)
      }
    } catch (error) {
      console.error('Error loading saved charts:', error)
      setSavedCharts([])
    }
  }, [isStorage])

  // Save charts to localStorage whenever savedCharts changes
  useEffect(() => {
    if (!isStorage || savedCharts.length === 0) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharts))
    } catch (error) {
      console.error('Error saving charts to localStorage:', error)
    }
  }, [savedCharts, isStorage])

  const saveChart = useCallback(
    (chart: Omit<SavedChart, 'id' | 'createdAt'>): boolean => {
      if (!isStorage) return false

      try {
        const newChart: SavedChart = {
          ...chart,
          id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
        }

        setSavedCharts(prev => {
          const updated = [newChart, ...prev]
          // Keep only the latest MAX_CHARTS
          return updated.slice(0, MAX_CHARTS)
        })

        return true
      } catch (error) {
        console.error('Error saving chart:', error)
        return false
      }
    },
    [isStorage]
  )

  const deleteChart = useCallback(
    (id: string): boolean => {
      if (!isStorage) return false

      try {
        setSavedCharts(prev => prev.filter(chart => chart.id !== id))
        return true
      } catch (error) {
        console.error('Error deleting chart:', error)
        return false
      }
    },
    [isStorage]
  )

  const loadChart = useCallback(
    (id: string): SavedChart | null => {
      try {
        const chart = savedCharts.find(c => c.id === id)
        return chart || null
      } catch (error) {
        console.error('Error loading chart:', error)
        return null
      }
    },
    [savedCharts]
  )

  const updateChart = useCallback(
    (id: string, updates: Partial<SavedChart>): boolean => {
      if (!isStorage) return false

      try {
        setSavedCharts(prev =>
          prev.map(chart => (chart.id === id ? { ...chart, ...updates } : chart))
        )
        return true
      } catch (error) {
        console.error('Error updating chart:', error)
        return false
      }
    },
    [isStorage]
  )

  const exportCharts = useCallback((): string => {
    try {
      return JSON.stringify(savedCharts, null, 2)
    } catch (error) {
      console.error('Error exporting charts:', error)
      return ''
    }
  }, [savedCharts])

  const importCharts = useCallback(
    (jsonData: string): boolean => {
      if (!isStorage) return false

      try {
        const importedCharts = JSON.parse(jsonData) as SavedChart[]

        // Validate imported data
        if (!Array.isArray(importedCharts)) {
          throw new Error('Invalid data format')
        }

        // Merge with existing charts, avoiding duplicates
        setSavedCharts(prev => {
          const existingIds = new Set(prev.map(c => c.id))
          const newCharts = importedCharts.filter(c => !existingIds.has(c.id))
          const merged = [...prev, ...newCharts]

          // Sort by creation date (newest first) and limit
          return merged
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_CHARTS)
        })

        return true
      } catch (error) {
        console.error('Error importing charts:', error)
        return false
      }
    },
    [isStorage]
  )

  const clearAllCharts = useCallback((): void => {
    if (!isStorage) return

    try {
      setSavedCharts([])
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing charts:', error)
    }
  }, [isStorage])

  return {
    savedCharts,
    saveChart,
    deleteChart,
    loadChart,
    updateChart,
    exportCharts,
    importCharts,
    clearAllCharts,
    isStorage,
  }
}
