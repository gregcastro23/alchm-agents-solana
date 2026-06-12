# Agent Data Sync - Quick Start Guide

## TL;DR

```bash
# Sync everything (one command)
yarn sync:all

# Or step by step
yarn sync:db           # TypeScript → Neon
yarn sync:chromadb     # Neon → ChromaDB
yarn sync:validate     # Verify consistency
```

---

## When to Sync

### 🆕 Adding New Agents

1. Create agent file in `lib/agents/historical/`
2. Add to `lib/agents/historical/index.ts`
3. Run: `yarn sync:all`

### ✏️ Updating Existing Agents

1. Edit agent file in `lib/agents/historical/`
2. Run: `yarn sync:all`

### 🗄️ After Database Changes

1. Run Prisma migrations
2. Run: `yarn sync:all`

### 🔍 Checking Consistency

Run: `yarn sync:validate`

---

## Available Commands

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `yarn sync:all`          | **Complete sync pipeline (recommended)** |
| `yarn sync:db`           | Sync TypeScript → Neon Database          |
| `yarn sync:chromadb`     | Sync Neon → ChromaDB (rebuilds vectors)  |
| `yarn sync:validate`     | Check consistency across all systems     |
| `yarn sync:clear-chroma` | Clear ChromaDB collection                |

---

## Prerequisites

### 1. ChromaDB Running

```bash
# Check status
curl http://localhost:8001/api/v1/heartbeat

# Start (Docker)
docker start planetary-chroma
```

### 2. OpenAI API Key

```bash
# Should be in .env.local
grep OPENAI_API_KEY .env.local
```

### 3. Database Connection

```bash
# Should be in .env.local
grep DATABASE_URL .env.local
```

---

## Troubleshooting

### "ChromaDB is not running"

```bash
docker start planetary-chroma
```

### "OPENAI_API_KEY not set"

```bash
# Make sure it's in .env.local
echo 'OPENAI_API_KEY=sk-...' >> .env.local
```

### "Systems are out of sync"

```bash
# Force resync everything
yarn sync:all --force
```

### "Invalid Date" errors (BCE dates)

```bash
# Add agent to BCE_AGENTS mapping in:
# scripts/seed-historical-agents.ts
```

---

## Architecture

```
TypeScript Definitions (52 agents)
    ↓ [yarn sync:db]
Neon PostgreSQL (52 agents)
    ↓ [yarn sync:chromadb]
ChromaDB (71 document chunks)
```

**Why 71 documents from 52 agents?**

- Some agents have more content and are split into multiple chunks
- Each chunk is ~512 tokens for optimal embedding

---

## Success Indicators

After running `yarn sync:validate`, you should see:

```
✅ All systems are in sync!

TypeScript Definitions: 52 agents
Neon Database:          52 agents
ChromaDB:               52 unique agents (71 documents)
```

---

## Quick Checks

```bash
# Count agents in database
npx tsx scripts/check-all-agents.ts

# List agents in ChromaDB
npx tsx scripts/list-chromadb-agents.ts

# Check ChromaDB collection
npx tsx scripts/check-chromadb.ts
```

---

## For More Details

See: `CHROMADB_SYNC_COMPLETE.md`
