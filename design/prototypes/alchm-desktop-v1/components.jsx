// components.jsx — shared atoms for the Alchm prototype
// Imported globally; exports onto window so other JSX files can use them.

const { useState, useEffect, useRef, useMemo } = React

// ── Elemental sigils — minimal geometric glyphs, not hand-drawn art ────
function ElementGlyph({ element, size = 12 }) {
  // simple alchemical triangle marks (the classical four)
  const stroke = 'currentColor'
  const sw = 1.2
  const p = {
    Fire: (
      <polygon
        points="6,1.5 11,10 1,10"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    ),
    Water: (
      <polygon
        points="6,10.5 11,2 1,2"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    ),
    Earth: (
      <g fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
        <polygon points="6,10.5 11,2 1,2" />
        <line x1="2.6" y1="6.5" x2="9.4" y2="6.5" />
      </g>
    ),
    Air: (
      <g fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
        <polygon points="6,1.5 11,10 1,10" />
        <line x1="2.6" y1="6" x2="9.4" y2="6" />
      </g>
    ),
  }[element]
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-label={element}>
      {p}
    </svg>
  )
}

// ── ElementChip — name + glyph in elemental color ─────────────────────
function ElementChip({ element }) {
  return (
    <span className="chip element">
      <ElementGlyph element={element} size={10} />
      {element}
    </span>
  )
}

// ── AlchSlider — gold-thumb slider with progress fill ─────────────────
function AlchSlider({ value, onChange, min = 0, max = 1, step = 0.01 }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="alch-slider">
      <div className="track" />
      <div className="fill" style={{ width: `${pct}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  )
}

// ── Lucide-style coin icons (Sparkles / Droplets / Box / Zap) ────────
// Stroke-icon set matching the production TokenHUD.tsx mapping.
function CoinIcon({ kind, size = 13 }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  if (kind === 'Sparkles')
    return (
      <svg {...p}>
        <path d="M12 3l2.4 5.2L20 10.5l-5.6 2.3L12 18l-2.4-5.2L4 10.5l5.6-2.3L12 3z" />
        <path d="M19 4l.8 1.6L21.4 6.4 19.8 7.2 19 9l-.8-1.8L16.6 6.4 18.2 5.6 19 4z" />
      </svg>
    )
  if (kind === 'Droplets')
    return (
      <svg {...p}>
        <path d="M7 17a5 5 0 1 0 7.2-4.5l-1.4-1.7-1.4 1.7A5 5 0 0 0 7 17z" />
        <path d="M14 4a3 3 0 0 1 4.7 3.5l-1.4 1.6A3 3 0 0 1 14 4z" />
      </svg>
    )
  if (kind === 'Box')
    return (
      <svg {...p}>
        <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
        <path d="M3 7l9 4 9-4M12 11v10" />
      </svg>
    )
  if (kind === 'Zap')
    return (
      <svg {...p}>
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    )
  return null
}

// ── Coin chip in the ESMS wallet ──────────────────────────────────────
// Coins are NOT elemental — colors come from COINS (production tokens).
function Coin({ slot, value }) {
  const meta = COINS[slot]
  return (
    <div className="coin" style={{ color: meta.hex }}>
      <div className="coin-glyph">
        <CoinIcon kind={meta.icon} size={13} />
      </div>
      <div className="coin-text">
        <span className="coin-name">{meta.name}</span>
        <span className="coin-value">{value}</span>
      </div>
    </div>
  )
}

// ── Wallet — the 4 coin chips in a 2×2 grid ───────────────────────────
function Wallet({ coins }) {
  return (
    <div className="wallet">
      <div className="wallet-grid">
        <Coin slot="spirit" value={coins.spirit} />
        <Coin slot="essence" value={coins.essence} />
        <Coin slot="matter" value={coins.matter} />
        <Coin slot="substance" value={coins.substance} />
      </div>
    </div>
  )
}

// ── ConsciousnessLevel bar (7 tiers) ──────────────────────────────────
function LevelTrack({ level }) {
  const name = CONSCIOUSNESS_LEVELS[level - 1] || 'Dormant'
  return (
    <div className="level-track">
      <div className="level-bar">
        {CONSCIOUSNESS_LEVELS.map((_, i) => (
          <div
            key={i}
            className="level-pip"
            data-on={i < level ? '1' : '0'}
            data-current={i === level - 1 ? '1' : '0'}
          />
        ))}
      </div>
      <div className="level-label">
        <span>Tier {level}/7</span>
        <b>{name}</b>
      </div>
    </div>
  )
}

// ── Harmonics readout (Monica & Kalchm constants) ─────────────────────
function HarmonicsReadout({ monica, kalchm }) {
  return (
    <div className="harmonics">
      <div className="harmonic">
        <div className="label">Monica A♯</div>
        <div className="value">
          <i>A♯</i>
          {monica.toFixed(4)}
        </div>
      </div>
      <div className="harmonic">
        <div className="label">Kalchm K</div>
        <div className="value">
          <i>K</i>
          {kalchm.toFixed(4)}
        </div>
      </div>
    </div>
  )
}

// ── HistoricalDietCard ────────────────────────────────────────────────
function HistoricalDietCard({ diet }) {
  if (!diet) return null
  return (
    <div className="diet-card">
      <div className="diet-cuisine">{diet.cuisine}</div>
      <div className="diet-philosophy">"{diet.philosophy}"</div>
      <div className="diet-row">
        <span className="lbl">Staples</span>
        <span className="val">{diet.staples.join(' · ')}</span>
      </div>
      <div className="diet-row">
        <span className="lbl">Favoured</span>
        <span className="val">{diet.favoriteFoods.join(' · ')}</span>
      </div>
      <div className="diet-row">
        <span className="lbl">Avoid</span>
        <span className="val">{diet.avoidedFoods.join(' · ')}</span>
      </div>
      <div className="diet-row">
        <span className="lbl">Drink</span>
        <span className="val">{diet.beverages.join(' · ')}</span>
      </div>
    </div>
  )
}

// ── Sacred 7 — radial chart (SVG) ─────────────────────────────────────
function Sacred7Chart({ stats }) {
  // 7-pointed regular polygon, radial values 0..1
  const cx = 115,
    cy = 115,
    R = 92
  const N = 7
  const angle = i => (i / N) * Math.PI * 2 - Math.PI / 2

  // axis points at full radius
  const axisPt = i => {
    const a = angle(i)
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }
  }
  // value point
  const valPt = (i, v) => {
    const a = angle(i)
    return { x: cx + Math.cos(a) * R * v, y: cy + Math.sin(a) * R * v }
  }

  const polyPts = SACRED_7.map((s, i) => valPt(i, stats[s.key] || 0))
    .map(p => `${p.x},${p.y}`)
    .join(' ')

  // grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg className="sacred7-svg" viewBox="0 0 230 230" aria-label="Sacred 7 archetypes">
      {/* rings */}
      {rings.map((r, i) => (
        <polygon
          key={i}
          points={SACRED_7.map((_, j) => valPt(j, r))
            .map(p => `${p.x},${p.y}`)
            .join(' ')}
          fill="none"
          stroke="rgba(237, 228, 210, 0.07)"
          strokeWidth="0.5"
        />
      ))}
      {/* axes */}
      {SACRED_7.map((_, i) => {
        const a = axisPt(i)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={a.x}
            y2={a.y}
            stroke="rgba(237, 228, 210, 0.06)"
            strokeWidth="0.5"
          />
        )
      })}
      {/* value polygon */}
      <polygon
        points={polyPts}
        fill="rgba(var(--element-rgb), 0.18)"
        stroke="rgb(var(--element-rgb))"
        strokeWidth="1"
        style={{ filter: 'drop-shadow(0 0 6px rgba(var(--element-rgb), 0.4))' }}
      />
      {/* labels */}
      {SACRED_7.map((s, i) => {
        const a = angle(i)
        const lx = cx + Math.cos(a) * (R + 14)
        const ly = cy + Math.sin(a) * (R + 14)
        return (
          <text
            key={s.key}
            x={lx}
            y={ly}
            fontSize="9"
            fontFamily="var(--f-mono)"
            fill="var(--bone-dim)"
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="1.4"
          >
            {s.glyph}
          </text>
        )
      })}
      {/* center pip */}
      <circle cx={cx} cy={cy} r="1.5" fill="rgb(var(--element-rgb))" />
    </svg>
  )
}

// ── Sacred 7 legend (after the chart) ─────────────────────────────────
function Sacred7Legend({ stats }) {
  return (
    <div className="sacred7-legend">
      {SACRED_7.map(s => (
        <div key={s.key} className="s7-item">
          <span>
            {s.glyph} {s.label}
          </span>
          <span className="v">{Math.round((stats[s.key] || 0) * 100)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Planetary 12 — vertical bar list ──────────────────────────────────
function Planetary12({ stats }) {
  return (
    <div className="planetary">
      {PLANETARY_12.map(p => {
        const v = stats[p.key] || 0
        return (
          <div key={p.key} className="planet-row">
            <span className="planet-name">
              {p.glyph} {p.label}
            </span>
            <div className="planet-bar">
              <div className="pb-fill" style={{ width: `${v * 100}%` }} />
            </div>
            <span className="planet-val">.{String(Math.round(v * 1000)).padStart(3, '0')}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Alchemical Blueprint bar (4-element mix totalling 100%) ───────────
function BlueprintMix({ blueprint, dominantElement }) {
  const order = [dominantElement, ...Object.keys(blueprint).filter(e => e !== dominantElement)]
  return (
    <div className="blueprint">
      <div
        style={{
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        Alchemical Blueprint
      </div>
      <div className="blueprint-bar">
        {order.map(el => (
          <div
            key={el}
            className="seg"
            style={{ width: `${blueprint[el] * 100}%`, background: ELEMENTS[el].hex }}
          />
        ))}
      </div>
      <div className="blueprint-legend">
        {order.map(el => (
          <div key={el} className="bp-item">
            <span className="dot" style={{ background: ELEMENTS[el].hex }} />
            <span>{el}</span>
            <span className="pct">{Math.round(blueprint[el] * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Council overlay (full 6-slot picker) ──────────────────────────────
const ROLES = [
  { key: 'leader', label: 'Leader · Primary' },
  { key: 'advisor', label: 'Advisor · Secondary' },
  { key: 'specialist1', label: 'Specialist I · Context' },
  { key: 'specialist2', label: 'Specialist II · Context' },
  { key: 'support1', label: 'Support I · Resonant' },
  { key: 'support2', label: 'Support II · Resonant' },
]

function CouncilOverlay({ council, onClose }) {
  const filled = ROLES.map(r => council[r.key]).filter(Boolean)
  const elements = filled.map(id => AGENTS[id]?.element).filter(Boolean)
  // dominant element by count
  const elCount = elements.reduce((a, e) => {
    a[e] = (a[e] || 0) + 1
    return a
  }, {})
  const dominant = Object.entries(elCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Fire'

  return (
    <div className="council-overlay-bg" onClick={onClose}>
      <div className="council-overlay" onClick={e => e.stopPropagation()}>
        <h3>The Council</h3>
        <div className="sub">Unified Planetary Consciousness · 6 active slots</div>

        <div className="council-metrics">
          <div className="cm-cell">
            <div className="lbl">Collective Consciousness</div>
            <div className="val pct">{Math.round((filled.length / 6) * 100 + 12)}%</div>
          </div>
          <div className="cm-cell">
            <div className="lbl">Dominant Element</div>
            <div className="val" style={{ color: ELEMENTS[dominant].hex }}>
              {dominant}
            </div>
          </div>
          <div className="cm-cell">
            <div className="lbl">Synergy Bonus</div>
            <div className="val bonus">+{filled.length * 3}% coherence</div>
          </div>
        </div>

        <div className="council-slots">
          {ROLES.map(r => {
            const id = council[r.key]
            const agent = id ? AGENTS[id] : null
            if (!agent) {
              return (
                <div key={r.key} className="slot empty">
                  <div className="role" style={{ color: 'var(--muted)' }}>
                    {r.label}
                  </div>
                  <span>+ summon</span>
                </div>
              )
            }
            return (
              <div key={r.key} className="slot">
                <div className="role">{r.label}</div>
                <div className="agent" style={{ color: ELEMENTS[agent.element].hex }}>
                  <span className="sig">{agent.initials}</span>
                  <div className="info">
                    <span className="nm">{agent.name}</span>
                    <span className="el">
                      {agent.element} · {agent.model}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

Object.assign(window, {
  ElementGlyph,
  ElementChip,
  AlchSlider,
  Coin,
  CoinIcon,
  Wallet,
  LevelTrack,
  HarmonicsReadout,
  HistoricalDietCard,
  Sacred7Chart,
  Sacred7Legend,
  Planetary12,
  BlueprintMix,
  CouncilOverlay,
  ROLES,
})
