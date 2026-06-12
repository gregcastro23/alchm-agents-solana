'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { JING_MOVES } from '@/components/cosmic-agents/constants'
import type { CouncilAgent, JingMoveId } from '@/components/cosmic-agents/types'

interface LiveComposerClientProps {
  agents: CouncilAgent[]
}

const MOVE_ALIASES: Array<[JingMoveId, string[]]> = [
  ['meltdown', ['meltdown', 'fire', 'burn']],
  ['freeze', ['freeze', 'water', 'ice', 'chill']],
  ['tectonicRoot', ['tectonic root', 'tectonic', 'root', 'earth']],
  ['vacuum', ['vacuum', 'air', 'oxygen']],
  ['erode', ['erode', 'erosion', 'dissolve']],
]

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function hideLiveComposer() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('hide_live_composer')
  } catch {
    /* Running in a browser preview, or Tauri command unavailable. */
  }
}

async function drainCastResponse(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return

  while (true) {
    const { done } = await reader.read()
    if (done) break
  }
}

export function LiveComposerClient({ agents }: LiveComposerClientProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [command, setCommand] = useState('')
  const [casting, setCasting] = useState(false)

  const moveOptions = useMemo(
    () =>
      (Object.entries(JING_MOVES) as Array<[JingMoveId, (typeof JING_MOVES)[JingMoveId]]>).map(
        ([id, move]) => ({ id, move })
      ),
    []
  )

  const preferredCasterId = useMemo(() => {
    return (
      agents.find(agent => agent.kind === 'user')?.id ||
      agents.find(agent => agent.isRulerOfMoment)?.id ||
      agents[0]?.id ||
      ''
    )
  }, [agents])

  const preferredTargetId = useMemo(() => {
    return (
      agents.find(agent => agent.id === 'rumi')?.id ||
      agents.find(agent => agent.kind === 'historical')?.id ||
      agents.find(agent => agent.id !== preferredCasterId)?.id ||
      ''
    )
  }, [agents, preferredCasterId])

  const [casterId, setCasterId] = useState(preferredCasterId)
  const [targetId, setTargetId] = useState(preferredTargetId)
  const [moveId, setMoveId] = useState<JingMoveId>('freeze')

  useEffect(() => {
    setCasterId(current => current || preferredCasterId)
    setTargetId(current => current || preferredTargetId)
  }, [preferredCasterId, preferredTargetId])

  useEffect(() => {
    if (targetId && targetId !== casterId) return
    setTargetId(agents.find(agent => agent.id !== casterId)?.id || '')
  }, [agents, casterId, targetId])

  useEffect(() => {
    document.documentElement.classList.add('desktop-composer-html')
    document.body.classList.add('desktop-composer-body')
    inputRef.current?.focus()

    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('composer-open', () => {
          window.setTimeout(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
          }, 0)
        })
      )
      .then(removeListener => {
        unlisten = removeListener
      })
      .catch(() => {
        /* Browser preview without Tauri event bridge. */
      })

    return () => {
      document.documentElement.classList.remove('desktop-composer-html')
      document.body.classList.remove('desktop-composer-body')
      unlisten?.()
    }
  }, [])

  const resolveCommand = useCallback(() => {
    const normalizedCommand = normalize(command)
    const parsedMove =
      MOVE_ALIASES.find(([, aliases]) =>
        aliases.some(alias => normalizedCommand.includes(normalize(alias)))
      )?.[0] || moveId

    const parsedTarget =
      agents.find(agent => {
        const names = [agent.name, agent.id, agent.name.split(/\s+/)[0] || ''].map(normalize)
        return names.some(name => name && normalizedCommand.includes(name))
      })?.id || targetId

    return {
      casterId,
      moveId: parsedMove,
      targetId: parsedTarget === casterId ? targetId : parsedTarget,
    }
  }, [agents, casterId, command, moveId, targetId])

  const castMove = useCallback(async () => {
    if (casting || !casterId || !targetId) return

    const resolved = resolveCommand()
    setCasting(true)

    void fetch('/api/feed/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...resolved,
        eventId: `desktop-cast-${Date.now()}`,
        broadcast: true,
      }),
    })
      .then(drainCastResponse)
      .catch(err => {
        console.warn('[desktop/composer] cast failed:', err)
      })

    setCommand('')
    await hideLiveComposer()
    window.setTimeout(() => setCasting(false), 160)
  }, [casterId, casting, resolveCommand, targetId])

  const selectedMove = JING_MOVES[moveId]

  return (
    <section className="desktop-live-composer">
      <form
        className="composer-panel"
        onSubmit={event => {
          event.preventDefault()
          void castMove()
        }}
      >
        <div className="composer-drag-strip" data-tauri-drag-region aria-hidden="true" />
        <div className="composer-controls">
          <label>
            <span>Caster</span>
            <select value={casterId} onChange={event => setCasterId(event.target.value)}>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Move</span>
            <select value={moveId} onChange={event => setMoveId(event.target.value as JingMoveId)}>
              {moveOptions.map(({ id, move }) => (
                <option key={id} value={id}>
                  {move.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Target</span>
            <select value={targetId} onChange={event => setTargetId(event.target.value)}>
              {agents
                .filter(agent => agent.id !== casterId)
                .map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="composer-command-row">
          <span className="composer-glyph" aria-hidden="true">
            {selectedMove.glyph}
          </span>
          <input
            ref={inputRef}
            value={command}
            onChange={event => setCommand(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault()
                void hideLiveComposer()
              } else if (event.key === 'Enter') {
                event.preventDefault()
                void castMove()
              }
            }}
            placeholder="Freeze Rumi's logic"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={casting || !casterId || !targetId}>
            Cast
          </button>
        </div>
      </form>
    </section>
  )
}
