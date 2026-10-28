'use client'

import React from 'react'

export interface ModeSwitcherProps {
  mode: 'live' | 'solar-return'
  onModeChange: (next: 'live' | 'solar-return') => void
}

export function ModeSwitcher({ mode, onModeChange }: ModeSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Planetary council modes"
      className="inline-flex rounded-xl border border-[#424936] bg-[#090b0e] p-1 text-xs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'live'}
        aria-controls="council-panel"
        aria-label="Switch to Today's Live Planetary Council"
        onClick={() => onModeChange('live')}
        className={`rounded-lg px-3.5 py-1.5 transition-colors ${
          mode === 'live'
            ? 'bg-[#b8fc4b] text-[#050506] font-semibold'
            : 'text-[#c2cab0] hover:text-[#e0e4d2]'
        }`}
      >
        Today&apos;s Live Council
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === 'solar-return'}
        aria-controls="council-panel"
        aria-label="Switch to 1-Year-Ago Solar Return Conclave"
        onClick={() => onModeChange('solar-return')}
        className={`rounded-lg px-3.5 py-1.5 transition-colors ${
          mode === 'solar-return'
            ? 'bg-amber-400 text-[#050506] font-semibold'
            : 'text-[#c2cab0] hover:text-[#e0e4d2]'
        }`}
      >
        ☉ 1-Year-Ago Solar Return
      </button>
    </div>
  )
}
