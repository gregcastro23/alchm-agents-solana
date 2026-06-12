# Next Session Prompt: Integrate Local MCP Sidecars into Tauri Desktop App

## 🌌 Context

We have successfully built and fully instrumented two Model Context Protocol (MCP) servers:

1. **Alchm MCP Server** (TypeScript/Bun) — provides live sky transits, ingredient ESMS alchemical scoring, and cosmic recipe catalog indexing.
2. **Planetary Agents MCP Server** (Python) — provides cognitive persona chats, feed thread retrieval, and multi-agent culinary debates, secured with API-key gating.

Currently, these run as stdio servers or API endpoints. Our **Desktop App** is a Tauri-based desktop shell (`desktop-shell/`) built with Vite and React. In this next session, we will turn both MCP servers into local background **Sidecars** or embedded services inside the Tauri application, unlocking offline astrological calculations, local persona chats, and native tool-calling entirely inside the desktop app.

---

## 🎯 Goal

Embed the **Alchm MCP server** and the **Planetary Agents MCP server** directly into the Tauri desktop application as background sidecars, allowing the desktop shell to establish a direct stdio-based JSON-RPC connection to them for ultra-low latency alchemical calculations and local persona consultation.

---

## 🛠️ The Six-Item Desktop MCP Integration Pass

### 1. Tauri Sidecar Packaging Configuration

- Configure both the TypeScript/Bun server (`mcp-server`) and the Python server (`planetary_agents_mcp_server.py`) as background binaries inside `src-tauri/tauri.conf.json` under `bundle > externalBin`.
- Define platform-specific binaries for macOS (Apple Silicon/Intel) and Windows/Linux.

### 2. Sidecar Spawn & Lifecycle Orchestration

- Implement a Tauri backend listener in Rust (`src-tauri/src/main.rs`) or in the Vite/TS shell using Tauri’s `shell` plugin (`@tauri-apps/plugin-shell`) to spawn both MCP servers as background processes at application startup.
- Ensure clean process hygiene: automatically terminate both background servers on application exit to prevent zombie listener processes.

### 3. Tauri-to-MCP stdio JSON-RPC Client

- Implement a lightweight TypeScript stdio transport client inside the `desktop-shell/src/` directory utilizing Tauri's `Command` stream.
- Speak standard JSON-RPC: send `initialize`, `tools/list`, and `tools/call` requests over standard input, and read responses from standard output.
- Wrap this in a custom React hook `useLocalMcp()` or a global Zustand state to coordinate local queries.

### 4. Grounding Desktop Chat in Local MCP

- Refactor the desktop shell's chat UI (`desktop-shell/src/components/chat/`) to route agent chats directly to the local spawned Planetary Agents MCP sidecar when the app is in "Local/Offline Mode".
- Allow single-user desktop installs to automatically read a local `DesktopApiKey` token from the shell config or use the `PA_USER_API_KEY` environmental shortcut.

### 5. Local Telemetry & Health Dashboard

- Add a beautiful "MCP Node Health" status panel inside the desktop app's settings/admin panel.
- Query the sidecars' status and display live diagnostic telemetry (e.g. status of connections, Swiss Ephemeris loading, and local Python environment availability).

### 6. End-to-End Local Verification & Test Suite

- Add Tauri mock shell unit tests to verify stdio command spawning.
- Test offline capabilities by disabling the internet connection and confirming that transits and Socrates chats fallback successfully to the local sidecars.

---

## 📂 Proposed File Changes

- **[MODIFY]** `src-tauri/tauri.conf.json` — Add the external sidecar configuration for `alchm-mcp` and `pa-mcp`.
- **[MODIFY]** `src-tauri/src/main.rs` — Implement process cleanup and stdio routing if Rust sidecar management is used.
- **[NEW]** `desktop-shell/src/lib/mcp/localMcpClient.ts` — Implement the TypeScript JSON-RPC transport utilizing `@tauri-apps/plugin-shell`.
- **[NEW]** `desktop-shell/src/hooks/useLocalMcp.ts` — A React hook to easily call local tools.
- **[MODIFY]** `desktop-shell/src/components/settings/McpStatusPanel.tsx` — Expose the sidecar diagnostics dashboard.

---

## 🔮 Verification Plan

- Run Tauri dev environment: `bun run dev:tauri`
- Verify sidecars launch successfully in the background on startup.
- Test E2E stdio communications by calling `get_live_sky_transits` locally.
