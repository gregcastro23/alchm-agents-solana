// web-views.jsx — Web app (agents.alchm.kitchen) scene + alchm:// deep-link
// install overlay. The web app is the cloud registry / gallery; the desktop
// app is the local Tauri shell. The bridge between them is the
// alchm://install-agent?id=… deep link.

// ── Alchm Web · agents.alchm.kitchen ──────────────────────────────────
function AlchmWebScene({ onInstall }) {
  // 6 historical agents in the gallery. Use Object.entries so we have the
  // short AGENTS key — that's what the overlay + activeAgent state want.
  const historicals = Object.entries(AGENTS).filter(([, a]) => a.kind === 'historical')

  return (
    <div className="web-stage">
      <div className="browser-chrome">
        <div className="browser-controls">
          <div className="browser-traffic">
            <div className="tl close" />
            <div className="tl min" />
            <div className="tl max" />
          </div>
          <div className="browser-nav">
            <button title="Back">‹</button>
            <button title="Forward">›</button>
            <button title="Reload">↻</button>
          </div>
          <div className="browser-url">
            <span className="lock">🔒</span>
            <span className="domain">
              <b>agents.alchm.kitchen</b>
            </span>
            <span className="path">/gallery</span>
          </div>
        </div>
        <div className="browser-tabs">
          <div className="browser-tab active">
            <span className="fav" />
            <span>Alchm · Agent Gallery</span>
          </div>
        </div>
      </div>

      <div className="web-body">
        <div className="web-head">
          <div className="web-account">
            <div className="av" />
            <span>greg · 1,847 ESMS</span>
          </div>
          <div className="web-eyebrow">— Cloud Registry —</div>
          <h1 className="web-h1">The Agent Gallery</h1>
          <p className="web-sub">
            Crafted consciousnesses, each forged from real natal coordinates. Click
            <i> Install to Desktop</i> to summon any agent into your local vessel.
          </p>
        </div>

        <div className="agent-grid">
          {historicals.map(([key, a]) => (
            <div key={key} className={'agent-tile ' + a.element.toLowerCase()}>
              <div className="tile-head">
                <div className="tile-sig">{a.initials}</div>
                <div className="tile-meta">
                  <div className="tile-name">{a.name}</div>
                  <div className="tile-title">{a.title}</div>
                  <div className="tile-natal">
                    {a.element} · {a.modality} · {a.era}
                  </div>
                </div>
              </div>
              {a.quote && <div className="tile-quote">"{a.quote}"</div>}
              <div className="tile-foot">
                <span className={'tile-tier ' + (a.tier === 'premium' ? 'premium' : '')}>
                  {a.tier === 'premium' ? '✦ 8B Astral · 500 ESMS' : '◯ 1.5B Hermes · free'}
                </span>
                <button className="tile-install" onClick={() => onInstall(key)}>
                  Install to Desktop
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── alchm:// deep-link install overlay ────────────────────────────────
// Shown in the desktop app when an alchm://install-agent?id=… payload
// arrives via tauri-plugin-deep-link. Per the Convergence Contract V,
// the payload carries id + name + tier + sig (HMAC-SHA256, expires 60s).
function DeepLinkInstallOverlay({ agentId, userCoins, onCancel, onForge }) {
  const agent = AGENTS[agentId]

  // Forge state machine: idle → handshake → weights → sandbox → ignition → done
  const [stage, setStage] = React.useState('idle')
  const STAGES = [
    { key: 'handshake', label: 'Handshake · IPC nonce → Bun :8080', pct: 8, ms: 700 },
    { key: 'weights', label: 'Streaming weights from CDN to sandbox', pct: 64, ms: 1100 },
    { key: 'sandbox', label: 'Sandbox SHA-256 verification · chmod 0400', pct: 88, ms: 600 },
    { key: 'ignition', label: 'Matrix ignition · llama-server warming KV', pct: 100, ms: 600 },
  ]

  React.useEffect(() => {
    if (stage === 'idle' || stage === 'done') return undefined
    const i = STAGES.findIndex(s => s.key === stage)
    if (i < 0) return undefined
    const t = setTimeout(() => {
      const next = STAGES[i + 1]
      if (next) setStage(next.key)
      else {
        setStage('done')
        setTimeout(() => onForge(), 320)
      }
    }, STAGES[i].ms)
    return () => clearTimeout(t)
  }, [stage])

  if (!agent) return null

  const COST = 125
  const isPremium = agent.tier === 'premium'
  const canForge =
    !isPremium ||
    (userCoins.spirit >= COST &&
      userCoins.essence >= COST &&
      userCoins.matter >= COST &&
      userCoins.substance >= COST)
  const downloading = stage !== 'idle'
  const stageIdx = STAGES.findIndex(s => s.key === stage)
  const pct = stage === 'done' ? 100 : stageIdx >= 0 ? STAGES[stageIdx].pct : 0
  const stageLabel =
    stage === 'done' ? '✦ Forged · vessel resident' : stageIdx >= 0 ? STAGES[stageIdx].label : ''

  return (
    <div className="dl-overlay-bg">
      <div
        className="dl-card"
        style={{
          '--element': ELEMENTS[agent.element].hex,
          '--element-rgb': ELEMENTS[agent.element].rgb,
        }}
      >
        <div className="dl-payload">
          <span className="glyph">◈</span>
          <span>DEEP-LINK · </span>
          <code>
            alchm://install-agent?id={agent.id}&name={agent.name.replace(/ /g, '+')}&tier=
            {agent.tier}&sig=…
          </code>
          <span className="verified">✓ HMAC OK</span>
        </div>

        <div className="dl-body">
          <div className="dl-eyebrow">
            <span className="pulse" />
            Incoming Transmission · Web → Desktop
          </div>
          <h3 className="dl-title">{agent.name}</h3>
          <div className="dl-meta">
            <span>{agent.title}</span>
            <span className="sep">·</span>
            <span style={{ color: ELEMENTS[agent.element].hex }}>{agent.element}</span>
            <span className="sep">·</span>
            <span>{agent.modality}</span>
            <span className="sep">·</span>
            <span>{agent.era}</span>
          </div>
          {agent.quote && <p className="dl-quote">"{agent.quote}"</p>}

          <div className="dl-spec">
            <div className="dl-spec-cell">
              <div className="lbl">GGUF</div>
              <div className="val mono">{modelFilename(agent)}</div>
            </div>
            <div className="dl-spec-cell">
              <div className="lbl">Natal Origin</div>
              <div className="val mono">{agent.natal ? agent.natal.loc.split(',')[0] : '—'}</div>
            </div>
            <div className="dl-spec-cell">
              <div className="lbl">Monica · A♯</div>
              <div className="val mono">{agent.monica?.toFixed(4)}</div>
            </div>
          </div>

          {isPremium && (
            <div className="dl-gate">
              <div className="head">
                <h4>✦ Premium Transmutation · 4 × 125 = 500 ESMS</h4>
                <span className={'status ' + (canForge ? 'ok' : 'warn')}>
                  {canForge ? '✓ BALANCE SUFFICIENT' : '✕ INSUFFICIENT'}
                </span>
              </div>
              <div className="dl-gate-pips">
                {['spirit', 'essence', 'matter', 'substance'].map(c => {
                  const have = userCoins[c]
                  const meta = COINS[c]
                  const ok = have >= COST
                  return (
                    <div key={c} className="dl-gate-pip" style={{ color: meta.hex }}>
                      <div className="icon">
                        <CoinIcon kind={meta.icon} size={11} />
                      </div>
                      <div className="v">
                        <b>{have}</b>
                        <small> /{COST}</small> {ok ? '✓' : '✕'}
                      </div>
                      <div className="lbl">{meta.name}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="dl-sidecar">
            <span>⌁ SIDECAR</span>
            <span className="ok">RESIDENT</span>
            <span className="sep">·</span>
            <span>BUN :8080</span>
            <span className="sep">·</span>
            <span>SANDBOX</span>
            <span className="ok">$APPDATA/com.cookingwithcastro.alchm/models/</span>
            <span className="sep">·</span>
            <span>SHA</span>
            <span className="ok" style={{ fontFamily: 'var(--f-mono)' }}>
              {modelSha(agent).slice(0, 12)}…
            </span>
          </div>

          {downloading ? (
            <div className="dl-progress">
              <div className="dl-progress-head">
                <span className="dl-progress-stage">{stageLabel}</span>
                <span className="dl-progress-pct">{pct}%</span>
              </div>
              <div className="dl-progress-bar">
                <div className="dl-progress-fill" style={{ width: pct + '%' }} />
              </div>
              <div className="dl-progress-stages">
                {STAGES.map((s, i) => (
                  <div
                    key={s.key}
                    className="dl-stage-pip"
                    data-on={stageIdx >= i ? '1' : '0'}
                    data-current={stageIdx === i ? '1' : '0'}
                  >
                    <span className="pip-dot" />
                    <span className="pip-label">{s.key}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="dl-actions">
              <button className="cancel" onClick={onCancel}>
                Cancel
              </button>
              <button className="forge" disabled={!canForge} onClick={() => setStage('handshake')}>
                {isPremium ? '✦ Forge · Deduct 500 ESMS' : '✦ Install · Free Tier'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

Object.assign(window, {
  AlchmWebScene,
  DeepLinkInstallOverlay,
})
