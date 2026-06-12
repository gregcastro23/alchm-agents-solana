# Planetary Agents - Agentic Workflows & LangChain Integration

This document outlines the specialized agentic workflows and LangChain integrations activated in this repository.

## 🚀 Activated Features

### 1. Knowledge Updater API (`/api/knowledge-updater`)

- **Purpose:** Dynamic ingestion of web content and PDF documents into the agent knowledge base (ChromaDB).
- **Endpoint:** `POST /api/knowledge-updater`
- **Capabilities:**
  - Scrape and ingest web URLs using `CheerioWebBaseLoader`.
  - Extract and ingest text from PDF documents using `PDFLoader`.
- **Requirements:** `USE_RAG_GENERATION=true` in environment.

### 2. LangChain Agent Router (`/api/langchain-agent`)

- **Purpose:** Advanced ReAct agent orchestrator for complex multi-step reasoning.
- **Endpoint:** `POST /api/langchain-agent`
- **Tools Available:**
  - `semantic_agent_search`: Find agents by concept/topic.
  - `knowledge_retrieval`: Fetch RAG context.
  - `consciousness_analysis`: Calculate synergy and compatibility.
  - `multi_agent_coordinator`: Assemble a council of agents for a query.
  - `memory_retrieval`: Retrieve interaction history.

### 3. Enhanced Semantic Search (`/api/agents/semantic-search`)

- **Purpose:** High-performance vector search with health monitoring.
- **Endpoints:**
  - `POST /api/agents/semantic-search`: Query agent knowledge.
  - `GET /api/agents/semantic-search`: Check RAG health and collection status.

### 4. Dynamic Moon Degree & Phase Intelligence

- **Purpose:** Native enrichment of the 360 Moon degree agents with their exact lunar phase characteristics, bringing psychological depth and spiritual awareness to chats.
- **Capabilities:**
  - Automatically maps any Moon degree query (absolute degree 0-359) to its correct phase (New Moon, Waxing Crescent, First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter, Waning Crescent, Dark Moon).
  - Injects a specialized, premium `## Lunar Phase Influence` block into system prompts containing the phase's archetype, emotional characteristics, and alchemical traits.
- **Migration & Seeding:** Supported by `backend/improve_moon_degree_agents.py` to retroactively enrich all Moon degree records in the shared database.

## 🛠️ Configuration

### Development Environment

- **Package Manager:** [Bun](https://bun.sh/) is the mandatory package manager and runtime for this project.
- **Execution:** Always use `bun` or `bun --bun` for running scripts and development servers (e.g., `bun --bun run dev`).
- **Dependency Management:** Use `bun install`, `bun add`, and `bun remove`.

To fully enable these features, ensure the following environment variables are set:

- `USE_RAG_GENERATION=true`
- `CHROMADB_URL=http://localhost:8001` (or your production ChromaDB endpoint)
- `OPENAI_API_KEY` (required for embeddings and LangChain agents)

## 📁 Key Files

- `lib/langchain/`: Core LangChain integration logic.
- `lib/llamaindex/`: Vector store and embedding services.
- `app/api/`: Corresponding API routes.
- `backend/main.py`: dynamic chat auto-registration and moon phase calculation.
- `backend/prompts.py`: system prompt generation for moon phase agents.
- `backend/improve_moon_degree_agents.py`: DB migration script for 360 moon degree agents.
