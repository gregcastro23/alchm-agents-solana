'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const PENTACLES_TABS = [
  { href: '/pentacles', label: 'Sky Vaults' },
  { href: '/pentacles/star-agents', label: 'Star Agents' },
  { href: '/pentacles/portfolio', label: 'Your Portfolio' },
  { href: '/pentacles/connect', label: 'Arc Onboarding' },
  { href: '/pentacles/war', label: 'War Table Command' },
] as const

const linkStyle: React.CSSProperties = {
  color: '#9aa0d8',
  fontWeight: 500,
  textDecoration: 'none',
  fontSize: 14,
  transition: 'color 0.2s',
}

/** Shared sub-navigation across all Pentacles Sanctum views. */
export default function ConnectNav() {
  const pathname = usePathname()

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        borderBottom: '1px solid rgba(122, 128, 200, 0.2)',
        paddingBottom: 10,
        marginTop: 12,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {PENTACLES_TABS.map(tab => {
          const isActive = pathname === tab.href
          if (isActive) {
            return (
              <span
                key={tab.href}
                style={{
                  color: '#ffd76a',
                  fontWeight: 700,
                  fontSize: 14,
                  borderBottom: '2px solid #ffd76a',
                  paddingBottom: 2,
                }}
              >
                {tab.label}
              </span>
            )
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={linkStyle}
              onMouseEnter={e => (e.currentTarget.style.color = '#e7e9ff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9aa0d8')}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <Link
        href="/arena"
        style={{
          color: '#ffd76a',
          fontSize: 12,
          fontFamily: 'var(--font-mono), monospace',
          textDecoration: 'none',
          padding: '4px 10px',
          borderRadius: 999,
          border: '1px solid rgba(255, 215, 106, 0.35)',
          background: 'rgba(255, 215, 106, 0.08)',
        }}
      >
        Synastry Arena →
      </Link>
    </div>
  )
}
