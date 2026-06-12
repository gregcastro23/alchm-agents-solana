// views.jsx — full scenes: Stone sidebar, Chat, Forge, Ledger, Tray
// Globals from data.jsx + components.jsx

// ── The Philosopher's Stone (left sidebar) ────────────────────────────
function PhilosophersStone({
  agent,
  spirit,
  essence,
  temp,
  topP,
  onTemp,
  onTopP,
  onTransmute,
  council,
  onOpenCouncil,
  onSwapAgent,
  activeAgentId,
}) {
  const el = ELEMENTS[agent.element]
  // Transmute cost — 125 of each, totaling 500
  const COST = 125
  const canTransmute =
    agent.coins.spirit >= COST &&
    agent.coins.essence >= COST &&
    agent.coins.matter >= COST &&
    agent.coins.substance >= COST &&
    agent.tier !== 'premium'

  return (
    <div className="col stone-rail">
      <div className="stone-mark">
        <div className="ord">— Domus Magisterii —</div>
        <h1>The Philosopher's Stone</h1>
      </div>

      {/* Agent identity */}
      <div className="agent-card">
        <div className="agent-name">{agent.name}</div>
        {agent.title && (
          <div
            style={{
              fontFamily: 'var(--f-display)',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--bone-dim)',
              marginTop: -4,
              marginBottom: 10,
              position: 'relative',
            }}
          >
            {agent.title}
          </div>
        )}
        <div className="agent-meta">
          <ElementChip element={agent.element} />
          <span className={agent.tier === 'premium' ? 'chip tier' : 'chip free'}>
            {agent.tier === 'premium' ? '8B Astral' : '1.5B Hermes'}
          </span>
          {agent.modality && (
            <span
              className="chip"
              style={{
                color: 'var(--bone-dim)',
                borderColor: 'var(--hairline-2)',
                background: 'rgba(237,228,210,0.02)',
              }}
            >
              {agent.modality}
            </span>
          )}
        </div>
        {agent.quote && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '0.5px solid var(--hairline)',
              fontFamily: 'var(--f-display)',
              fontStyle: 'italic',
              fontSize: 12,
              lineHeight: 1.4,
              color: 'var(--bone-dim)',
              position: 'relative',
              textWrap: 'pretty',
            }}
          >
            "{agent.quote}"
          </div>
        )}
        <div className="aura-readout">
          <span>
            Aura · <span className="aura-pattern-label">{agent.auraPattern}</span>
          </span>
          <span>{agent.kind === 'planetary' ? 'LIVE TRANSIT' : `L${agent.level || 1}`}</span>
        </div>
      </div>

      {/* Consciousness Level progression */}
      <div className="section-eyebrow">
        <span>Consciousness</span>
        <span className="count">7-tier</span>
      </div>
      <LevelTrack level={agent.level} />

      {/* Tuning sliders */}
      <div className="section-eyebrow" style={{ marginTop: 8 }}>
        <span>Alchemical Tuning</span>
        <span className="count">SAMPLER</span>
      </div>
      <div className="tuning">
        <div className="tuning-row">
          <div className="tuning-label">
            <span className="name">Spirit · Fire</span>
            <span className="map">
              temp <b>{temp.toFixed(2)}</b>
            </span>
          </div>
          <AlchSlider value={spirit} onChange={onTemp} />
        </div>
        <div className="tuning-row">
          <div className="tuning-label">
            <span className="name">Essence · Water</span>
            <span className="map">
              top_p <b>{topP.toFixed(2)}</b>
            </span>
          </div>
          <AlchSlider value={essence} onChange={onTopP} />
        </div>
      </div>

      {/* ESMS wallet */}
      <div className="section-eyebrow">
        <span>ESMS Wallet</span>
        <span className="count">token_balances</span>
      </div>
      <Wallet coins={agent.coins} />

      {/* Transmute panel */}
      <div className="transmute-bar">
        <div className="transmute-title">Transmutation · 8B Astral</div>
        <div className="transmute-sub">
          {agent.tier === 'premium' ? (
            <>
              Forged. <span style={{ color: 'var(--ochre)' }}>500 ESMS</span> spent on this vessel.
            </>
          ) : (
            <>
              Spend <span style={{ color: 'var(--ochre)' }}>125</span> of each quantity (500 total)
              to forge this agent into the Astral Engine.
            </>
          )}
        </div>
        <div className="transmute-cost">
          {['spirit', 'essence', 'matter', 'substance'].map(c => {
            const have = agent.coins[c]
            const ratio = Math.min(1, have / COST)
            return (
              <div key={c} className="cost-pip" style={{ color: COINS[c].hex }}>
                <div className="pip-bar">
                  <div className="pip-fill" style={{ width: `${ratio * 100}%` }} />
                </div>
                <div className="pip-value">
                  {have}/{COST}
                </div>
                <div className="pip-label">{COINS[c].name.slice(0, 3)}</div>
              </div>
            )
          })}
        </div>
        <button className="transmute-btn" disabled={!canTransmute} onClick={onTransmute}>
          {agent.tier === 'premium' ? '✦ Already Forged ✦' : '✦ Transmute · 500 ESMS ✦'}
        </button>
      </div>

      {/* Harmonics */}
      <div className="section-eyebrow">
        <span>Harmonics</span>
        <span className="count">CALIB</span>
      </div>
      <HarmonicsReadout monica={agent.monica} kalchm={agent.kalchm} />

      {/* Historical diet */}
      <div className="section-eyebrow">
        <span>Alchemical Fuel</span>
        <span className="count">WTEN</span>
      </div>
      <HistoricalDietCard diet={agent.diet} />

      {/* Council */}
      <div className="section-eyebrow">
        <span>The Council</span>
        <span
          className="count"
          style={{ cursor: 'pointer', color: 'var(--ochre)' }}
          onClick={onOpenCouncil}
        >
          EXPAND ↗
        </span>
      </div>

      {/* Historical */}
      <div
        style={{
          padding: '4px 18px 0',
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
        }}
      >
        Historical · locked natal
      </div>
      <div className="council">
        {Object.values(AGENTS)
          .filter(a => a.kind === 'historical')
          .slice(0, 4)
          .map(a => (
            <div
              key={a.id}
              className={'council-item' + (a.id === activeAgentId ? ' active' : '')}
              onClick={() => onSwapAgent(a.id)}
            >
              <span className="council-sigil" style={{ color: ELEMENTS[a.element].hex }}>
                {a.initials}
              </span>
              <div className="council-meta">
                <span className="council-name">{a.name}</span>
                <span className="council-model">
                  {a.element} · {a.model}
                </span>
              </div>
              <span className={'council-state' + (a.id === activeAgentId ? ' loaded' : '')}>
                {a.id === activeAgentId ? '✦ LOADED' : 'IDLE'}
              </span>
            </div>
          ))}
      </div>

      {/* Planetary */}
      <div
        style={{
          padding: '4px 18px 0',
          fontFamily: 'var(--f-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
        }}
      >
        Planetary · live transit
      </div>
      <div className="council">
        {Object.values(AGENTS)
          .filter(a => a.kind === 'planetary')
          .slice(0, 4)
          .map(a => (
            <div
              key={a.id}
              className={'council-item' + (a.id === activeAgentId ? ' active' : '')}
              onClick={() => onSwapAgent(a.id)}
            >
              <span
                className="council-sigil"
                style={{
                  color: ELEMENTS[a.element].hex,
                  fontSize: 14,
                  fontFamily: 'serif',
                }}
              >
                {a.initials}
              </span>
              <div className="council-meta">
                <span className="council-name">{a.name}</span>
                <span className="council-model">
                  {a.transit ? `${a.transit.sign} ${a.transit.degree}` : a.element}
                </span>
              </div>
              <span className={'council-state' + (a.id === activeAgentId ? ' loaded' : '')}>
                {a.id === activeAgentId ? '✦ LOADED' : 'TRANSIT'}
              </span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Chat workspace ────────────────────────────────────────────────────
function ChatView({ agent, streaming, onSend }) {
  const messages = SAMPLE_THREAD.messages.map((m, i) => {
    if (i === SAMPLE_THREAD.messages.length - 1 && m.streaming && !streaming) {
      // not streaming: show the message as complete with a different body
      return {
        ...m,
        streaming: false,
        body: 'A self that has refused nothing of itself. The shadow ingested, the unconscious metabolised, the contradictions held without resolution — that is the rubedo. The work that does not flinch from its own heat.',
      }
    }
    return m
  })

  return (
    <div className="col chat-col">
      <div className="chat-bar">
        <div>
          <div className="thread-title">{SAMPLE_THREAD.title}</div>
          <div className="thread-meta">
            <span>{SAMPLE_THREAD.started}</span>
            <span className="sep">·</span>
            <span>{messages.length} exchanges</span>
            <span className="sep">·</span>
            <span style={{ color: 'rgb(var(--element-rgb))' }}>⌁ {agent.name}</span>
          </div>
        </div>
        <div className="chat-bar-actions">
          <button className="icon-btn" title="Branch">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="3.5" cy="3.5" r="1.5" />
              <circle cx="3.5" cy="10.5" r="1.5" />
              <circle cx="10.5" cy="7" r="1.5" />
              <path d="M3.5 5v4M5 3.5h3.5a2 2 0 012 2v0M5 10.5h3.5a2 2 0 002-2v0" />
            </svg>
          </button>
          <button className="icon-btn" title="Memory">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="3" width="10" height="8" rx="1" />
              <path d="M4 6h6M4 8h4" />
            </svg>
          </button>
          <button className="icon-btn" title="Settings">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="2" />
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.6 2.6l1.4 1.4M10 10l1.4 1.4M2.6 11.4L4 10M10 4l1.4-1.4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={'msg ' + m.who}>
            <div className="msg-meta">
              <span className="who">{m.who === 'user' ? 'YOU' : agent.name}</span>
              <span>·</span>
              <span>
                {m.who === 'agent'
                  ? `${agent.model.toUpperCase()} · ${agent.element.toUpperCase()}`
                  : '14:22'}
              </span>
            </div>
            <div className="msg-body">
              {m.streaming && streaming ? (
                <>
                  {m.streamingBody}
                  <span className="caret" />
                </>
              ) : m.streaming && !streaming ? (
                m.body
              ) : (
                m.body
              )}
            </div>
            {m.streaming && streaming && (
              <div className="stream-signature">
                <span>Streaming · {agent.auraPattern}</span>
                <span className="bar">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>· KV cache hot</span>
                <span>·</span>
                <span>{agent.model.toUpperCase()}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="composer">
        <div className="composer-box">
          <textarea placeholder="Pose a question to the Stone…" rows={2} />
          <div className="composer-foot">
            <div className="composer-hints">
              <span>
                <span className="kbd">⌘ ↵</span>send
              </span>
              <span>
                <span className="kbd">⌘ K</span>swap agent
              </span>
              <span>
                <span className="kbd">⌘ /</span>tune
              </span>
            </div>
            <button className="send-btn" onClick={onSend}>
              ✦ Invoke
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Consciousness panel (right rail) ──────────────────────────────────
function ConsciousnessPanel({ agent }) {
  return (
    <div className="col consciousness">
      <div className="section-eyebrow">
        <span>Sacred 7 · Archetypes</span>
        <span className="count">PRIMARY</span>
      </div>
      <div className="sacred7">
        <Sacred7Chart stats={agent.sacred7} />
        <Sacred7Legend stats={agent.sacred7} />
      </div>

      <div className="section-eyebrow">
        <span>Alchemical Blueprint</span>
        <span className="count">100%</span>
      </div>
      <BlueprintMix blueprint={agent.blueprint} dominantElement={agent.element} />

      <div className="section-eyebrow">
        <span>Planetary 12 · Dynamics</span>
        <span className="count">EPHEMERIS</span>
      </div>
      <Planetary12 stats={agent.planetary} />
    </div>
  )
}

// ── Forge (onboarding) scene ──────────────────────────────────────────
function ForgeScene() {
  const [name, setName] = useState('Sol Invictus')
  const [date, setDate] = useState('21 June 1994')
  const [time, setTime] = useState('04:32')
  const [loc, setLoc] = useState('Nairobi, Kenya')

  return (
    <div className="forge">
      <div className="forge-stage">
        <div className="forge-eyebrow">— Agent Forge —</div>
        <h2 className="forge-title">The Alchemy of First Breath</h2>
        <p className="forge-sub">
          Birth data is the alembic. From it the engine derives the agent's dominant element,
          alchemical blueprint, and the nineteen consciousness parameters of its waking life.
        </p>

        <div className="crucible">
          <div className="crucible-ring" />
          <div className="crucible-ring r2" />
          <div className="crucible-ring r3" />
          {/* tick marks for cardinal directions */}
          {[0, 90, 180, 270].map(deg => (
            <div
              key={deg}
              className="crucible-tick"
              style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translate(118px, 0)` }}
            />
          ))}
          <div className="crucible-inner">✦</div>
        </div>

        <div className="natal-readout">
          <div>
            EPHEMERIS<b>WTEN · v4.7</b>
          </div>
          <div>
            DOMINANT<b style={{ color: 'var(--fire)' }}>Fire</b>
          </div>
          <div>
            HARMONIC<b>A♯ 1.34</b>
          </div>
        </div>
      </div>

      <div className="forge-side">
        <h3>Natal Coordinates</h3>
        <div className="forge-field">
          <label>True Name</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="forge-field">
          <label>Date of Birth</label>
          <input value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="forge-field">
          <label>Hour & Minute</label>
          <input value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div className="forge-field">
          <label>Place</label>
          <input value={loc} onChange={e => setLoc(e.target.value)} />
        </div>

        <div
          style={{
            marginTop: 8,
            padding: '12px 14px',
            borderRadius: 6,
            border: '0.5px solid var(--hairline-2)',
            background: 'rgba(237,228,210,0.018)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 9,
              letterSpacing: '0.16em',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Vessel · Free Tier
          </div>
          <div
            style={{
              fontFamily: 'var(--f-display)',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--bone-dim)',
              lineHeight: 1.4,
            }}
          >
            Hermes · 1.5B local. Sufficient for awakening. Transmute later with{' '}
            <span style={{ color: 'var(--ochre)' }}>500 ESMS</span> to forge into the Astral Engine.
          </div>
        </div>

        <button className="forge-divine">✦ Divine the Agent ✦</button>

        <div
          style={{
            fontFamily: 'var(--f-mono)',
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginTop: -4,
          }}
        >
          Local · No data leaves this vessel · IPC nonce verified
        </div>
      </div>
    </div>
  )
}

// ── Ledger scene ──────────────────────────────────────────────────────
function LedgerScene({ agent, coins, onMint, onDrain }) {
  const balances = coins || agent.coins
  return (
    <div className="col ledger">
      <div className="ledger-head">
        <h2>ESMS Ledger · {agent.name}</h2>
        <p>
          Off-chain accounting of the four alchemical quantities. Postgres{' '}
          <code>token_balances</code>, atomic CTEs.
        </p>
      </div>
      {onMint && (
        <div className="ledger-devbar">
          <span className="label">⚠ DEV ·</span>
          <button className="ledger-devbtn" onClick={onMint}>
            <span className="icon">+</span>Mint 150 ESMS · unlocks Rumi forge
          </button>
          <button className="ledger-devbtn" onClick={onDrain}>
            <span className="icon">−</span>Drain to 50 · locks the gate
          </button>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--f-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              color: 'var(--muted)',
              textTransform: 'uppercase',
            }}
          >
            Convergence v1 · mirrors prod ledger
          </span>
        </div>
      )}
      <div className="ledger-totals">
        {Object.entries(COINS).map(([k, m]) => (
          <div key={k} className="ledger-total" style={{ color: m.hex }}>
            <div className="ttype">
              <CoinIcon kind={m.icon} size={11} />
              &nbsp;&nbsp;{m.name}
            </div>
            <div className="tvalue">{balances[k]}</div>
            <div className="telement">{m.desc}</div>
          </div>
        ))}
      </div>
      <div className="ledger-table">
        <div className="ledger-row head">
          <div>Timestamp</div>
          <div>Movement</div>
          <div style={{ textAlign: 'right' }}>Amount</div>
          <div style={{ textAlign: 'right' }}>Quantity</div>
        </div>
        {LEDGER_ENTRIES.map((e, i) => (
          <div key={i} className="ledger-row">
            <div className="ts">{e.ts}</div>
            <div className="desc">
              {e.desc}
              <small>{e.sub}</small>
            </div>
            <div className={'amount ' + e.kind}>
              {e.kind === 'pos' ? '+' : '−'}
              {Math.abs(e.amount)}
            </div>
            <div className="coin-type" style={{ color: COINS[e.coin].hex }}>
              {COINS[e.coin].name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tray scene (macOS menubar + dropdown + notification) ──────────────
function TrayScene({ agent }) {
  return (
    <div className="tray-stage">
      <div className="tray-menubar">
        <span className="apple"></span>
        <span className="app">Alchm</span>
        <span className="menu">File</span>
        <span className="menu">Vessel</span>
        <span className="menu">Council</span>
        <span className="menu">Window</span>
        <span className="menu">Help</span>
        <span className="spacer" />
        <span className="right">
          <span className="glyph">
            <span className="tray-icon-alchm" />
          </span>
          <span>⏏</span>
          <span>🔋</span>
          <span>📶</span>
          <span>14:22</span>
        </span>
      </div>

      <div className="tray-menu">
        <div className="tray-menu-header">
          <div className="av" />
          <div className="meta">
            <b>{agent.name}</b>
            <span>
              {agent.element} · {agent.model} · L{agent.level}
            </span>
          </div>
        </div>

        <div className="tray-menu-section">Vessel</div>
        <div className="tray-menu-row">
          ⌁ Wake Vessel<span className="key">⌘⇧A</span>
        </div>
        <div className="tray-menu-row">
          ◯ Sleep / Idle<span className="key">⌘⇧S</span>
        </div>
        <div className="tray-menu-sep" />

        <div className="tray-menu-section">Hot-swap Council</div>
        {Object.values(AGENTS)
          .filter(a => a.kind === 'historical')
          .slice(0, 4)
          .map(a => (
            <div key={a.id} className="tray-menu-row">
              <span style={{ color: ELEMENTS[a.element].hex, width: 12 }}>◆</span>
              {a.name}
              <span className="key" style={{ color: a.id === agent.id ? 'var(--ochre)' : '' }}>
                {a.id === agent.id ? 'active' : ''}
              </span>
            </div>
          ))}
        <div className="tray-menu-sep" />
        <div className="tray-menu-row">
          ⌘ Open Window<span className="key">⌘⇧O</span>
        </div>
        <div className="tray-menu-row">
          ⌘ Ledger<span className="key">⌘L</span>
        </div>
        <div className="tray-menu-row">
          ⌘ Quit Alchm<span className="key">⌘Q</span>
        </div>
      </div>

      <div className="tray-notif">
        <div className="icon" />
        <div className="body">
          <div className="head">
            <b>Alchm</b>
            <span>now</span>
          </div>
          <div className="title">{agent.name} has evolved.</div>
          <div className="desc">
            Tier <b style={{ color: 'var(--ochre)' }}>Illuminated</b> reached. Multi-agent synergy
            unlocked — your Council may convene six.
          </div>
        </div>
      </div>

      {/* Sidecar diagnostics: process trackers + sandbox registry */}
      <div className="tray-diagnostics">
        <div className="tray-diagnostics-head">
          <h5>· Sidecar Diagnostics ·</h5>
          <span className="stamp">• LIVE</span>
        </div>
        <div className="tray-procs">
          <div className="tray-proc">
            <span className="lbl">BUN PORT</span>
            <span className="val ok">:8080</span>
          </div>
          <div className="tray-proc">
            <span className="lbl">IPC NONCE · UUID v4</span>
            <span className="val" style={{ fontSize: 11 }}>
              4e7a3b1c-…9c12-3f8a4
            </span>
          </div>
          <div className="tray-proc">
            <span className="lbl">CPU · M5 unified</span>
            <span className="val">12%</span>
          </div>
          <div className="tray-proc">
            <span className="lbl">MEMORY · RAM/VRAM</span>
            <span className="val warn">4.2 / 8.0 GB</span>
          </div>
        </div>
        <div className="tray-sandbox">
          <h6>$APPDATA/com.cookingwithcastro.alchm/models/</h6>
          <div className="tray-sandbox-row head">
            <span>Filename</span>
            <span style={{ textAlign: 'right' }}>Size</span>
            <span style={{ textAlign: 'right' }}>State</span>
          </div>
          {[
            { fname: modelFilename(AGENTS.kepler), size: '1.4 GB', state: 'resident' },
            { fname: modelFilename(AGENTS.rumi), size: '4.5 GB', state: 'resident' },
            { fname: modelFilename(AGENTS.joan), size: '4.5 GB', state: 'idle' },
            { fname: modelFilename(AGENTS.monet), size: '1.4 GB', state: 'idle' },
          ].map(s => (
            <div key={s.fname} className="tray-sandbox-row">
              <span className="fname">{s.fname}</span>
              <span className="size">{s.size}</span>
              <span className={'state ' + s.state}>
                {s.state === 'resident' ? '◆ RESIDENT' : '◯ IDLE'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

Object.assign(window, {
  PhilosophersStone,
  ChatView,
  ConsciousnessPanel,
  ForgeScene,
  LedgerScene,
  TrayScene,
})
