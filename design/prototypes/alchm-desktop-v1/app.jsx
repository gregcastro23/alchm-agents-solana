// app.jsx — root component. Mounts the window, manages scene + agent state,
// drives CSS custom properties from the active agent's element.

const { useState, useEffect, useRef, useMemo, useCallback } = React

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  view: 'chat',
  activeAgent: 'kepler',
  auraPattern: 'swirling',
  streaming: true,
  elementOverride: 'auto',
  showCouncil: false,
  palette: 'ember',
  motion: 'atmospheric',
  temp: 0.72,
  topP: 0.91,
} /*EDITMODE-END*/

// Palette swatches for the tweak picker
// eslint-disable-next-line no-unused-vars
const PALETTES = {
  ember: ['#1a0f0a', '#c44a2e', '#e8b04a'],
  obsidian: ['#0a0a0f', '#7a5cff', '#d4a857'],
  abyssal: ['#080d12', '#2e7a8c', '#4ad6c4'],
}

function applyPalette(name) {
  const root = document.documentElement
  ;['--char-0', '--char-1', '--char-2', '--char-3', '--ember', '--ochre', '--ochre-rgb'].forEach(
    v => root.style.removeProperty(v)
  )
  if (name === 'cosmic') {
    // Lifted from real app/globals.css (.dark theme): deep indigo/violet,
    // primary 263 70% 50% → #8b5cf6.
    root.style.setProperty('--char-0', '#050210')
    root.style.setProperty('--char-1', '#0c0319')
    root.style.setProperty('--char-2', '#1e0a3c')
    root.style.setProperty('--char-3', '#2e1065')
    root.style.setProperty('--ember', '#8b5cf6')
    root.style.setProperty('--ochre', '#a78bfa')
    root.style.setProperty('--ochre-rgb', '167, 139, 250')
  } else if (name === 'obsidian') {
    root.style.setProperty('--char-0', '#06060a')
    root.style.setProperty('--char-1', '#0a0a12')
    root.style.setProperty('--char-2', '#10101a')
    root.style.setProperty('--char-3', '#1a1a26')
    root.style.setProperty('--ember', '#7a5cff')
    root.style.setProperty('--ochre', '#d4a857')
    root.style.setProperty('--ochre-rgb', '212, 168, 87')
  } else if (name === 'abyssal') {
    root.style.setProperty('--char-0', '#040810')
    root.style.setProperty('--char-1', '#080d18')
    root.style.setProperty('--char-2', '#0d141f')
    root.style.setProperty('--char-3', '#152030')
    root.style.setProperty('--ember', '#2e7a8c')
    root.style.setProperty('--ochre', '#4ad6c4')
    root.style.setProperty('--ochre-rgb', '74, 214, 196')
  }
  // 'ember' default — styles.css values apply.
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
  const [transmuted, setTransmuted] = useState(false)
  const [showCouncil, setShowCouncil] = useState(false)
  const [installPayload, setInstallPayload] = useState(null) // agent id from web

  // The user's ESMS ledger balance — keyed by user, not by agent. Coins
  // live here so the dev controllers (Mint/Drain in the Ledger) can move
  // them, the install overlay can gate on them, and the Philosopher's Stone
  // sidebar always shows the same wallet regardless of active agent.
  const [userCoins, setUserCoins] = useState(AGENTS[DEFAULT_AGENT_ID].coins)
  const mintESMS = () =>
    setUserCoins(c => ({
      spirit: c.spirit + 150,
      essence: c.essence + 150,
      matter: c.matter + 150,
      substance: c.substance + 150,
    }))
  const drainESMS = () =>
    setUserCoins({
      spirit: 50,
      essence: 50,
      matter: 50,
      substance: 50,
    })

  // Active agent — default is Kepler; merge with selected for swap.
  // Always override coins with the global userCoins so the wallet is unified.
  const agent = useMemo(() => {
    const base = AGENTS[DEFAULT_AGENT_ID]
    const sel = AGENTS[t.activeAgent] || base
    return {
      ...base,
      ...sel,
      coins: userCoins,
      tier: sel.id === base.id && transmuted ? 'premium' : sel.tier || base.tier,
      auraPattern: t.auraPattern,
      element: t.elementOverride !== 'auto' ? t.elementOverride : sel.element || base.element,
    }
  }, [t.activeAgent, t.auraPattern, t.elementOverride, transmuted, userCoins])

  // Static council party (referenced by sidebar + overlay)
  const partyCouncil = useMemo(
    () => ({
      leader: t.activeAgent,
      advisor: 'rumi',
      specialist1: 'joan',
      specialist2: 'avicenna',
      support1: 'monet',
      support2: null,
    }),
    [t.activeAgent]
  )

  // Drive CSS custom properties from active element + apply palette
  useEffect(() => {
    const el = ELEMENTS[agent.element]
    if (!el) return
    const root = document.documentElement
    root.style.setProperty('--element', el.hex)
    root.style.setProperty('--element-rgb', el.rgb)
  }, [agent.element])

  useEffect(() => {
    applyPalette(t.palette)
  }, [t.palette])

  // Map slider 0..1 to llama.cpp sampler params
  const temp = t.temp
  const topP = t.topP

  const titlebarTabs = [
    { key: 'chat', label: 'Chat' },
    { key: 'forge', label: 'Forge' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'web', label: 'Web App' },
    { key: 'tray', label: 'Tray' },
  ]

  return (
    <>
      <div className="alchm-window" data-streaming={t.streaming && t.view === 'chat' ? '1' : '0'}>
        <div className="aura-frame" data-pattern={agent.auraPattern} />

        {/* macOS-style titlebar with scene tabs in the centre */}
        <div className="titlebar">
          <div className="traffic-lights">
            <div className="traffic-light close" />
            <div className="traffic-light minimize" />
            <div className="traffic-light maximize" />
          </div>
          <div className="titlebar-title" style={{ marginLeft: 16 }}>
            <b>ALCHM</b>
            <span className="sep">·</span>
            <span>The Philosopher's Stone</span>
            {t.view === 'chat' && (
              <>
                <span className="sep">·</span>
                <span style={{ color: 'rgb(var(--element-rgb))' }}>⌁ {agent.name}</span>
              </>
            )}
          </div>
          <div className="titlebar-tools">
            <button
              className="titlebar-sim"
              title="Simulate alchm:// install (Rumi)"
              onClick={() => setInstallPayload('rumi')}
            >
              ◈ SIM
            </button>
            {titlebarTabs.map(tab => (
              <button
                key={tab.key}
                className="tab"
                data-active={t.view === tab.key ? '1' : '0'}
                onClick={() => setTweak('view', tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scene render */}
        {t.view === 'chat' && (
          <div className="workspace">
            <PhilosophersStone
              agent={agent}
              spirit={temp}
              essence={topP}
              temp={temp}
              topP={topP}
              onTemp={v => setTweak('temp', v)}
              onTopP={v => setTweak('topP', v)}
              onTransmute={() => setTransmuted(true)}
              council={partyCouncil}
              onOpenCouncil={() => setShowCouncil(true)}
              onSwapAgent={id => setTweak('activeAgent', id)}
              activeAgentId={t.activeAgent}
            />
            <ChatView
              agent={agent}
              streaming={t.streaming}
              onSend={() => setTweak('streaming', true)}
            />
            <ConsciousnessPanel agent={agent} />
          </div>
        )}
        {t.view === 'forge' && <ForgeScene />}
        {t.view === 'ledger' && (
          <LedgerScene
            agent={
              agent.kind === 'planetary' ? { ...AGENTS[DEFAULT_AGENT_ID], coins: userCoins } : agent
            }
            coins={userCoins}
            onMint={mintESMS}
            onDrain={drainESMS}
          />
        )}
        {t.view === 'tray' && <TrayScene agent={agent} />}
        {t.view === 'web' && <AlchmWebScene onInstall={id => setInstallPayload(id)} />}

        {/* Engineering status rail */}
        <div className="statusrail">
          <span>
            <span className="pulse" />
            SIDECAR <b style={{ color: 'rgb(var(--element-rgb))' }}>READY</b>
          </span>
          <span className="sep">·</span>
          <span>
            BUN <b>:8080</b>
          </span>
          <span className="sep">·</span>
          <span>
            LLAMA-SERVER <b className="ok">RESIDENT</b>
          </span>
          <span className="sep">·</span>
          <span>
            IPC NONCE <b>0x4e7a…3b1c</b> <span className="ok">✓</span>
          </span>
          <div className="right">
            <span>
              KV-CACHE <b>92%</b>
            </span>
            <span className="sep">·</span>
            <span>
              VRAM <b>4.2/8.0G</b>
            </span>
            <span className="sep">·</span>
            <span>
              IDLE-KILL <b className="warn">4:38</b>
            </span>
            <span className="sep">·</span>
            <span>
              LEDGER <b className="ok">SYNCED</b>
            </span>
            <span className="convergence-stamp" title="Web ↔ Desktop contract signed">
              <span className="pulse" />
              Convergence v1
            </span>
          </div>
        </div>

        {showCouncil && (
          <CouncilOverlay council={partyCouncil} onClose={() => setShowCouncil(false)} />
        )}

        {installPayload && (
          <DeepLinkInstallOverlay
            agentId={installPayload}
            userCoins={userCoins}
            onCancel={() => setInstallPayload(null)}
            onForge={() => {
              // Atomic decrement when premium— mirrors the Postgres CTE.
              const target = AGENTS[installPayload]
              if (target?.tier === 'premium') {
                setUserCoins(c => ({
                  spirit: c.spirit - 125,
                  essence: c.essence - 125,
                  matter: c.matter - 125,
                  substance: c.substance - 125,
                }))
              }
              setInstallPayload(null)
              setTweak('view', 'chat')
              setTweak('activeAgent', installPayload)
            }}
          />
        )}
      </div>

      {/* outer halo that bleeds beyond window edges when streaming */}
      <div className="alchm-halo" />

      {/* Tweaks ─────────────────────────────────────────────── */}
      <TweaksPanel title="Tweaks · Philosopher's Stone">
        <TweakSection label="Scene">
          <TweakRadio
            label="View"
            value={t.view}
            options={[
              { value: 'chat', label: 'Chat' },
              { value: 'forge', label: 'Forge' },
              { value: 'ledger', label: 'Ledger' },
              { value: 'web', label: 'Web' },
              { value: 'tray', label: 'Tray' },
            ]}
            onChange={v => setTweak('view', v)}
          />
          <TweakButton
            label="Open Council overlay"
            onClick={() => setShowCouncil(true)}
            secondary
          />
          <TweakButton
            label="Simulate alchm:// install (Rumi)"
            onClick={() => setInstallPayload('rumi')}
            secondary
          />
        </TweakSection>

        <TweakSection label="Aura">
          <TweakSelect
            label="Active agent"
            value={t.activeAgent}
            options={Object.values(AGENTS).map(a => ({
              value: a.id,
              label: `${a.name} · ${a.element}`,
            }))}
            onChange={v => setTweak('activeAgent', v)}
          />
          <TweakSelect
            label="Element override"
            value={t.elementOverride}
            options={[
              { value: 'auto', label: 'Auto (from agent)' },
              { value: 'Fire', label: 'Fire · Spirit' },
              { value: 'Water', label: 'Water · Essence' },
              { value: 'Earth', label: 'Earth · Matter' },
              { value: 'Air', label: 'Air · Substance' },
            ]}
            onChange={v => setTweak('elementOverride', v)}
          />
          <TweakSelect
            label="Aura pattern"
            value={t.auraPattern}
            options={AURA_PATTERNS.map(p => ({ value: p, label: p }))}
            onChange={v => setTweak('auraPattern', v)}
          />
          <TweakToggle
            label="Streaming (glow)"
            value={t.streaming}
            onChange={v => setTweak('streaming', v)}
          />
        </TweakSection>

        <TweakSection label="Sampler">
          <TweakSlider
            label="Spirit → temp"
            value={t.temp}
            min={0}
            max={1}
            step={0.01}
            onChange={v => setTweak('temp', v)}
          />
          <TweakSlider
            label="Essence → top_p"
            value={t.topP}
            min={0}
            max={1}
            step={0.01}
            onChange={v => setTweak('topP', v)}
          />
        </TweakSection>

        <TweakSection label="Theme">
          <TweakSelect
            label="Palette"
            value={t.palette}
            options={[
              { value: 'ember', label: 'Ember (char + ochre)' },
              { value: 'cosmic', label: 'Cosmic (production violet)' },
              { value: 'obsidian', label: 'Obsidian + gold + violet' },
              { value: 'abyssal', label: 'Abyssal teal' },
            ]}
            onChange={v => setTweak('palette', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
