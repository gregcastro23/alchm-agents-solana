'use client'

import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import {
  BirthTimeRectifierPanel,
  type BirthTimeRectifierPanelProps,
} from '@/components/rectification/BirthTimeRectifierPanel'

export interface BirthTimeRectifierModalProps extends BirthTimeRectifierPanelProps {
  open: boolean
  onClose: () => void
  title?: string
}

export function BirthTimeRectifierModal({
  open,
  onClose,
  title = 'Interactive Birth Time Rectification',
  onApply,
  ...panelProps
}: BirthTimeRectifierModalProps) {
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [open])

  // Fallback for browsers without native <dialog closedby="any"> light-dismiss support (Safari)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return
    if ('closedBy' in HTMLDialogElement.prototype) return

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }

    let pressedOutside = false
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        onClose()
      }
      pressedOutside = false
    }

    dialog.addEventListener('pointerdown', onPointerDown)
    dialog.addEventListener('pointerup', onPointerUp)
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown)
      dialog.removeEventListener('pointerup', onPointerUp)
    }
  }, [open, onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = ''
        }
        onClose()
      }}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="rectifier-dialog m-auto max-h-[90vh] w-[min(96vw,64rem)] overflow-y-auto rounded-xl border border-violet-500/35 bg-slate-950 p-0 text-slate-100 shadow-2xl"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h2 id={headingId} className="text-lg font-semibold text-white">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close rectification dialog"
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <BirthTimeRectifierPanel
            {...panelProps}
            onApply={result => {
              onApply?.(result)
              onClose()
            }}
            onCancel={onClose}
          />
        </div>
      )}
    </dialog>
  )
}
