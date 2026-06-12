'use client'

/**
 * KnowledgeInfusionStep — multi-format ingestion step for the Philosopher's Stone.
 *
 * Drag-and-drop (or click) uploader for PDF / TXT / MD / JSON / DOCX. Files are
 * POSTed to /api/knowledge-updater/ingest, which extracts text per format,
 * chunks it, and embeds it into the agent's ChromaDB collection. Optional —
 * the user can skip straight to Ignition.
 */
import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react'

const ACCEPT = '.pdf,.txt,.md,.json,.docx'
const ACCEPT_EXT = ['pdf', 'txt', 'md', 'json', 'docx']

interface IngestResult {
  fileName: string
  success: boolean
  chunks?: number
  error?: string
}

interface Props {
  agentId: string
  onBack: () => void
  onContinue: () => void
}

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase()
const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

export function KnowledgeInfusionStep({ agentId, onBack, onContinue }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<IngestResult[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list).filter(f => ACCEPT_EXT.includes(extOf(f.name)))
    if (incoming.length) setFiles(prev => [...prev, ...incoming])
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files)
    e.target.value = ''
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const infuse = async () => {
    if (!files.length || uploading) return
    setUploading(true)
    setResults(null)
    try {
      const fd = new FormData()
      fd.append('agentId', agentId)
      for (const f of files) fd.append('files', f)

      const res = await fetch('/api/knowledge-updater/ingest', { method: 'POST', body: fd })
      const json = await res.json().catch(() => null)

      if (json?.status === 'disabled') {
        setResults([
          { fileName: 'Knowledge ingestion disabled', success: false, error: json.message },
        ])
      } else if (Array.isArray(json?.results)) {
        setResults(json.results)
      } else {
        setResults([
          { fileName: 'Upload', success: false, error: json?.error || 'Unexpected response' },
        ])
      }
    } catch (e) {
      setResults([
        {
          fileName: 'Upload',
          success: false,
          error: e instanceof Error ? e.message : 'Upload failed',
        },
      ])
    } finally {
      setUploading(false)
    }
  }

  const anySuccess = results?.some(r => r.success)

  return (
    <div className="bg-surface border border-border p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-500 absolute inset-0 overflow-y-auto">
      <h3 className="text-lg font-semibold text-zinc-300 border-b border-border pb-2">
        Knowledge Infusion
      </h3>
      <p className="text-sm text-zinc-400">
        Optionally feed this agent source texts to ground its voice. Supports PDF, TXT, MD, JSON and
        DOCX. You can also skip and infuse knowledge later.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-alchemical-spirit bg-zinc-950'
            : 'border-zinc-700 hover:border-zinc-600 bg-transparent'
        }`}
      >
        <Upload className="h-6 w-6 text-zinc-500" />
        <div className="text-sm text-zinc-300">
          Drag &amp; drop files here, or <span className="text-alchemical-spirit">browse</span>
        </div>
        <div className="text-xs text-zinc-600">PDF · TXT · MD · JSON · DOCX · up to 10 MB each</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={onSelect}
        />
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 truncate text-zinc-300">
                <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-zinc-600">{fmtSize(f.size)}</span>
              </span>
              {!uploading && (
                <button onClick={() => removeFile(i)} className="text-zinc-500 hover:text-red-400">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={infuse}
            disabled={uploading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-alchemical-spirit to-alchemical-essence px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Infusing {files.length} file
                {files.length > 1 ? 's' : ''}…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Infuse {files.length} file
                {files.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {r.success ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              )}
              <span className="text-zinc-300">
                {r.fileName}
                {r.success ? (
                  <span className="text-zinc-500"> — {r.chunks ?? 0} chunks embedded</span>
                ) : (
                  <span className="text-red-400/80"> — {r.error}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Nav */}
      <div className="absolute bottom-6 right-6 left-6 flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Tier Select
        </button>
        <button
          onClick={onContinue}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md bg-zinc-100 px-6 py-2 font-bold text-zinc-900 transition-all hover:bg-white disabled:opacity-50"
        >
          {anySuccess ? 'Continue to Ignition' : files.length ? 'Skip & Ignite' : 'Skip Infusion'}{' '}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default KnowledgeInfusionStep
