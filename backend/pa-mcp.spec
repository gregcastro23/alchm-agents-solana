# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the Planetary Agents MCP stdio server.
#
# Builds a self-contained executable that bundles the Python interpreter,
# httpx, SQLAlchemy, and the local backend/ modules (alchm_mcp,
# mcp_invocation_log, database, models). The resulting binary is dropped
# into src-tauri/bin/ so the Tauri desktop shell can spawn it without
# requiring a Python environment on the user's machine.
#
# Build (aarch64 native on Apple Silicon):
#   cd backend && venv/bin/pyinstaller pa-mcp.spec --noconfirm
#
# Cross-build (x86_64 on Apple Silicon, requires universal2 Python):
#   cd backend && TARGET_ARCH=x86_64 venv/bin/pyinstaller pa-mcp.spec \
#     --noconfirm --distpath dist-x86_64 --workpath build-x86_64
#
# NOTE: the `--target-arch` CLI flag is silently ignored when a spec
# file is supplied — PyInstaller uses the `target_arch` value passed to
# EXE() inside the spec. We thread it via the TARGET_ARCH env var so
# scripts/build-sidecar.sh can drive both builds from one spec.
#
# Output lands at backend/dist/pa-mcp (single-file) by default. The
# scripts/build-sidecar.sh wrapper moves it into src-tauri/bin/ with
# the proper platform-suffixed filename.

import os
import sys

block_cipher = None

backend_dir = os.path.abspath(os.path.dirname('pa-mcp.spec'))
if not backend_dir or backend_dir == '/':
    backend_dir = os.getcwd()

# Allow caller to override target arch via TARGET_ARCH env var.
# PyInstaller picks this up via EXE(... target_arch=...) below.
target_arch = os.environ.get('TARGET_ARCH', None)

a = Analysis(
    ['planetary_agents_mcp_server.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=[],
    hiddenimports=[
        # Local backend modules imported via string references inside
        # SQLAlchemy / Pydantic land may be missed by static analysis.
        'alchm_mcp',
        'mcp_invocation_log',
        'database',
        'models',
        # SQLAlchemy SQLite dialect — analysis sometimes misses these
        # because they're loaded by URL inspection at runtime. The
        # desktop sidecar only ever uses SQLite (database.py falls back
        # to a local file when DATABASE_URL is unset), so postgresql is
        # intentionally excluded.
        'sqlalchemy.dialects.sqlite',
        # python-dotenv is loaded in database.py at import time.
        'dotenv',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Heavy ML/data libs that live in the venv for the main FastAPI
        # backend but are NOT used by the MCP stdio server. Excluding
        # them keeps the bundle around ~30-50MB instead of >200MB.
        'numpy',
        'pandas',
        'scipy',
        'matplotlib',
        'torch',
        'tensorflow',
        'sklearn',
        'scikit-learn',
        'chromadb',
        'langchain',
        'langchain_core',
        'langchain_text_splitters',
        'llama_index',
        'sentence_transformers',
        'transformers',
        'huggingface_hub',
        'tokenizers',
        # IPython / Jupyter — bundled by some sub-deps but never used here.
        'IPython',
        'jupyter',
        'notebook',
        # GUI frameworks pulled in by matplotlib/etc.
        'tkinter',
        'PIL',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        # FastAPI server — only needed by the HTTP backend, not the
        # stdio MCP server. Excluding it drops uvicorn + starlette.
        'fastapi',
        'uvicorn',
        'starlette',
        # OpenAI / Anthropic — the MCP server proxies to the backend
        # over HTTP via httpx; it never calls these directly.
        'openai',
        'anthropic',
        'galileo',
        # psycopg2 wheels are per-architecture and arm64-only in this
        # venv. The desktop sidecar never reaches Postgres (it falls
        # back to SQLite via database.py:_resolve_dsn), so dropping
        # psycopg2 entirely is what enables cross-arch builds. If a
        # Postgres URL is ever set, mcp_invocation_log catches the
        # resulting ImportError and degrades to noop logging.
        'psycopg2',
        'psycopg2-binary',
        'sqlalchemy.dialects.postgresql',
        # SQLAlchemy 2.x ships Cython-compiled .so files in
        # sqlalchemy.cyextension that are per-architecture. The library
        # transparently falls back to pure-Python implementations when
        # they're absent. Excluding them shrinks the bundle slightly
        # and unblocks cross-arch builds from Apple Silicon.
        'sqlalchemy.cyextension',
        # Pydantic v2 ships a Rust core (.so) that is per-arch. Nothing
        # in the MCP server's import graph uses pydantic — it gets
        # pulled in transitively by venv-mate packages. Drop it.
        'pydantic',
        'pydantic_core',
        '_pydantic_core',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='pa-mcp',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=target_arch,
    codesign_identity=None,
    entitlements_file=None,
)
