# Desktop shell

The Vite-built renderer for the Tauri desktop companion app. It talks to the
local sidecar binaries (see [`src-tauri/bin/README.md`](../src-tauri/bin/README.md))
over a nonce-gated IPC channel and renders the offline/desktop UI.

## Architecture

This shell is **vanilla TypeScript**, not React. The entry point is
[`src/main.ts`](src/main.ts), which drives the UI through a hand-rolled
string-template `render()` loop. Supporting modules:

| File                    | Role                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| `src/main.ts`           | Entry point + vanilla render loop + sidecar lifecycle management       |
| `src/localMcpClient.ts` | `LocalMcpClient` — framework-agnostic MCP client with a snapshot store |
| `src/styles.css`        | Global styles                                                          |
| `index.html`            | Single mount document                                                  |
| `vite.config.ts`        | Vite config (no React plugin today)                                    |

## Unmounted React scaffolding (future-work)

Two files are authored in React **ahead of a future React migration** and are
**deliberately not bundled or mounted today**:

- `src/components/settings/McpStatusPanel.tsx` — per-sidecar MCP health panel
- `src/hooks/useLocalMcp.ts` — `useSyncExternalStore` wrapper over `LocalMcpClient`

They typecheck under the root tsconfig (which globs `**/*.tsx`) and exist as
"documentation-by-code" so the eventual React surface can drop in cleanly. They
are not imported by `main.ts`, so they ship no runtime code.

### To mount them later

1. `desktop-shell/vite.config.ts`: add `@vitejs/plugin-react`.
2. `desktop-shell/tsconfig.json` (or root): `jsx: "react-jsx"`.
3. `desktop-shell/index.html`: add a React root, e.g. `<div id="settings-root"/>`.
4. `desktop-shell/src/main.ts`: dynamic-import the component and
   `ReactDOM.createRoot(...).render(<McpStatusPanel sidecars={[...]} />)`.

`react` / `react-dom` / `@vitejs/plugin-react` are not yet dependencies — adding
them is the first step of that migration.

## Sidecars

The shell launches external binaries (`orchestrator`, `alchm-mcp`, `pa-mcp`,
`llama-server`) staged in `src-tauri/bin/`. Their build process and current
platform coverage are documented in
[`src-tauri/bin/README.md`](../src-tauri/bin/README.md).
