/**
 * Shape of `codebase-health-manifest.json`.
 *
 * Declared explicitly rather than inferred with `typeof manifest`: TypeScript
 * infers *literal* types from a JSON import, so an all-passing scan makes
 * `gates[].output` the type `null` and an empty array makes `never[]`. Code that
 * has to handle a failing gate then fails to compile purely because the last
 * scan happened to be clean — the type would describe one snapshot instead of
 * the format.
 *
 * Shared by `scripts/generate-codebase-health.ts` (producer), the admin route
 * (consumer) and the panel (renderer).
 */

export type CodebaseMarkerKind =
  | 'todo'
  | 'fixme'
  | 'hack'
  | 'xxx'
  | 'not-implemented'
  | 'ts-expect'
  | 'skipped-test'

export interface CodebaseMarker {
  kind: CodebaseMarkerKind | string
  file: string
  line: number
  text: string
}

export interface CodebaseGateResult {
  id: string
  label: string
  command: string
  passing: boolean
  durationMs: number
  /** Tail of the gate's output, present only when it failed. */
  output: string | null
}

export interface CodebaseHealthManifest {
  generatedAt: string
  commit: string | null
  branch: string | null
  scanDurationMs: number
  scannedRoots: string[]
  totals: {
    files: number
    lines: number
    markers: number
    markerDensityPerKLoc: number
  }
  byKind: Record<string, number>
  byArea: Array<{ area: string; count: number }>
  hotspots: Array<{ file: string; count: number }>
  markerCap: number
  markers: CodebaseMarker[]
  truncated: number
  natalProvenance: {
    counts: Record<string, number>
    placeholders: string[]
    total: number
    available: boolean
  }
  typeEscapes: {
    any: number
    nonNullAssertions: number
    worstFiles: Array<{ file: string; count: number }>
  }
  routeCoverage: {
    totalRoutes: number
    untestedCount: number
    coveragePct: number
    untested: string[]
    untestedTruncated: number
  }
  gates: CodebaseGateResult[]
  /** `ran: false` means the census was skipped — `total` is unknown, not zero. */
  typeErrors: {
    ran: boolean
    total: number
    byFile: Array<{ file: string; count: number }>
  }
  passes: {
    typecheck: boolean
    gates: boolean
  }
}
