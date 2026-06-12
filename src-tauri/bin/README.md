# Tauri sidecar binaries

The Tauri shell launches four external binaries from this directory (one
per `bin/<name>` entry in `src-tauri/tauri.conf.json`). Filenames follow
Tauri's `<name>-<rust-target-triple>` convention; the bundler picks the
one matching the build target automatically.

## Sidecars

| Name           | Source                                            | How it's built                  |
| -------------- | ------------------------------------------------- | ------------------------------- |
| `orchestrator` | `server.ts` (this repo)                           | `bun build --compile`           |
| `alchm-mcp`    | `../WhatToEatNext-master/mcp-server/src/index.ts` | `bun build --compile`           |
| `pa-mcp`       | `backend/planetary_agents_mcp_server.py`          | PyInstaller (see `pa-mcp.spec`) |
| `llama-server` | User-supplied Metal-compiled `llama-cli`          | Drop-in (see below)             |

## Current platform coverage

**These binaries are gitignored build artifacts** (see `.gitignore` —
`src-tauri/bin/{orchestrator,alchm-mcp,pa-mcp,llama-server}-*` are all
excluded), so nothing is committed to this directory. The table below is
therefore "which triples we can _produce_," not "what is checked in." Run
`scripts/build-sidecar.sh` (local) or the CI workflow to materialize them
before packaging.

Legend: ✅ local build script · 🤖 CI (`.github/workflows/sidecar-release.yml`) ·
❌ no coverage yet.

| Sidecar        | macOS arm64 (aarch64) | macOS x86_64 (Intel) | Windows | Linux |
| -------------- | :-------------------: | :------------------: | :-----: | :---: |
| `orchestrator` |          ✅           |         ✅¹          |   ❌    |  ❌   |
| `alchm-mcp`    |          ✅           |         ✅¹          |   ❌    |  ❌   |
| `pa-mcp`       |         ✅ 🤖         |        ✅ 🤖         |   🤖    |  🤖   |
| `llama-server` |          ✅²          |          ❌          |   ❌    |  ❌   |

¹ `orchestrator` / `alchm-mcp` are Bun-compiled; `--all-mac-archs` produces
both macOS arches locally. Windows/Linux need a Bun build on the target OS.
² `llama-server` is a drop-in (not built by the script). See below.

`pa-mcp` now has full four-triple coverage via CI: PyInstaller cannot
cross-compile, so the `sidecar-release.yml` matrix builds each triple on its
matching runner (macOS arm64, macOS Intel, Windows, Linux) and uploads one
artifact per triple. Locally, `scripts/build-sidecar.sh --all-mac-archs`
covers the two macOS arches (the Intel one via Rosetta). To extend the other
three sidecars to Windows/Linux, add them to the CI matrix or build on the
target OS — Wiring more of the GitHub Actions matrix (Path A) is the durable
way to keep all triples current.

## Build commands

The driver script is `scripts/build-sidecar.sh`.

```bash
# Current host arch only:
scripts/build-sidecar.sh

# Both Mac archs (requires Rosetta for x86_64 on Apple Silicon):
scripts/build-sidecar.sh --all-mac-archs

# Skip subset:
scripts/build-sidecar.sh --skip-orchestrator --skip-alchm-mcp
```

Output is staged at `<binary>.tmp` and atomically moved into place only
on success, so a failed build never leaves you with a half-written
binary.

## Cross-compile reality check

Tauri's universal Mac DMG needs both `aarch64-apple-darwin` and
`x86_64-apple-darwin` binaries. **PyInstaller's `--target-arch` flag is
not a true cross-compiler** — it rewrites the bootloader but still
bundles whatever native `.so` files exist in the source venv. Several
of pa-mcp's transitive deps (`pydantic_core`, `zstandard`,
`sqlalchemy.cyextension`, `psycopg2-binary`) only ship per-arch wheels.

The workaround `scripts/build-sidecar.sh` implements:

1. Detect Rosetta 2 (required to launch x86_64 processes on Apple Silicon).
2. Spawn a separate `backend/venv-x86_64/` via `arch -x86_64 python -m venv`.
3. `pip install` into it under `arch -x86_64` so pip resolves x86_64 wheels.
4. Run PyInstaller from that venv with `TARGET_ARCH=x86_64`.

If Rosetta isn't installed, the script tells you to run
`sudo softwareupdate --install-rosetta --agree-to-license` and bails out.

## Producing Windows and Linux binaries

PyInstaller cannot cross-compile to Windows or Linux from macOS — the
bootloader is platform-native and the wheel resolution must happen on
the target OS. Two paths:

### Path A — GitHub Actions matrix (recommended, now implemented for pa-mcp)

This is **live** for `pa-mcp` at `.github/workflows/sidecar-release.yml`. It
fans out across `macos-latest` (arm64), `macos-13` (Intel), `windows-latest`,
and `ubuntu-latest`, builds the spec on each, drives a real MCP
`initialize` + `tools/list` handshake as a smoke test, and uploads one
`pa-mcp-<triple>` artifact per platform. Trigger it by pushing a `v*` /
`sidecar-*` tag, or manually via the Actions tab (`workflow_dispatch`). The
sketch below is the underlying shape (the other three sidecars are not yet in
the matrix):

```yaml
# .github/workflows/sidecar-release.yml (sketch)
strategy:
  matrix:
    include:
      - os: macos-latest
        triple: aarch64-apple-darwin
      - os: macos-13 # last x86_64 macOS runner
        triple: x86_64-apple-darwin
      - os: windows-latest
        triple: x86_64-pc-windows-msvc
      - os: ubuntu-latest
        triple: x86_64-unknown-linux-gnu
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-python@v5
    with: { python-version: '3.11' }
  - run: |
      python -m venv .venv
      .venv/bin/pip install httpx sqlalchemy python-dotenv pyinstaller
      cd backend && ../.venv/bin/pyinstaller pa-mcp.spec --noconfirm --clean
  - uses: actions/upload-artifact@v4
    with:
      name: pa-mcp-${{ matrix.triple }}
      path: backend/dist/pa-mcp*
```

The downloaded artifacts get renamed to `pa-mcp-<triple>` (with `.exe`
suffix on Windows) and committed to `src-tauri/bin/` for each release.

### Path B — Local builds on each platform

If you have a Windows machine and a Linux machine handy:

```bash
# On Windows (PowerShell), in a fresh checkout:
python -m venv venv
venv\Scripts\pip install httpx sqlalchemy python-dotenv pyinstaller
cd backend
..\venv\Scripts\pyinstaller pa-mcp.spec --noconfirm --clean
copy dist\pa-mcp.exe ..\src-tauri\bin\pa-mcp-x86_64-pc-windows-msvc.exe

# On Linux (bash):
python3 -m venv venv
venv/bin/pip install httpx sqlalchemy python-dotenv pyinstaller
cd backend
../venv/bin/pyinstaller pa-mcp.spec --noconfirm --clean
cp dist/pa-mcp ../src-tauri/bin/pa-mcp-x86_64-unknown-linux-gnu
```

The same `pa-mcp.spec` works unchanged on every platform — the excludes
list inside it was tuned to be platform-agnostic.

## llama-server

This binary is **not built by `scripts/build-sidecar.sh`**. Compile a
Metal-enabled `llama.cpp` server binary and drop it here, renamed to
match the target triple (e.g. `llama-server-aarch64-apple-darwin`). The
`llama-server` Tauri sidecar is the local LLM inference path used when
the desktop shell is in offline mode.

If you change the llama binary's CLI flags, also update the spawn args
in `desktop-shell/src/main.ts`.
