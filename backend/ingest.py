"""
Populate ./chroma_db from the historical_agents PostgreSQL table.

Called automatically on FastAPI startup (background thread) when the collection
is empty. Can also be run as a standalone script:

  python ingest.py             # skip if already populated
  python ingest.py --force     # always clear and re-ingest

The collection name "historical-agents" must match the name queried in
main.py:/api/chat — changing it here without updating main.py will break RAG.
"""
from __future__ import annotations

import sys
from typing import List

import rag

COLLECTION_NAME = "historical-agents"
CHUNK_SIZE = 800    # characters — keeps each embedding small and topically focused
CHUNK_OVERLAP = 80  # characters


def _chunk_text(text: str) -> List[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + CHUNK_SIZE])
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def _build_document(agent) -> str:
    """Flatten rich agent fields into a single searchable text blob."""
    parts: List[str] = []

    def add(label: str, value) -> None:
        if not value:
            return
        if isinstance(value, list):
            value = ", ".join(str(v) for v in value if v)
        if isinstance(value, dict):
            value = " ".join(str(v) for v in value.values() if v)
        text = str(value).strip()
        if text:
            parts.append(f"{label}: {text}")

    add("Name", agent.name)
    add("Title", agent.title)
    add("Era", agent.historicalEra)
    add("Culture", agent.culture)
    add("Geography", agent.geography)
    add("Specialty", agent.specialty)
    add("Wisdom domains", agent.wisdomDomains)
    add("Skills", agent.skills)
    add("Teaching style", agent.teachingStyle)
    add("Resonance", agent.resonanceType)
    add("Unique power", agent.uniquePower)
    add("Consciousness signature", agent.signature)
    add("Consciousness level", agent.consciousnessLevel)
    add("Dominant element", agent.dominantElement)
    add("Personality", agent.personalityCore)
    add("Background", agent.background)

    if agent.monicaCreationStory:
        parts.append(agent.monicaCreationStory)
    if agent.searchableText:
        parts.append(agent.searchableText)

    return "\n".join(parts)


def run_ingest(force: bool = False) -> dict:
    """
    Populate ChromaDB from PostgreSQL.

    Returns {"agents": N, "chunks": M, "skipped": bool}.
    Safe to call multiple times — skips when already populated unless force=True.
    """
    # Fast-path: skip if already populated
    if not force:
        try:
            col = rag.vector_store.get_or_create_collection(COLLECTION_NAME)
            count = col.count()
            if count > 0:
                print(
                    f"[ingest] '{COLLECTION_NAME}' has {count} docs — "
                    "skipping. Pass --force (CLI) or force=True (API) to re-ingest.",
                    flush=True,
                )
                return {"agents": 0, "chunks": count, "skipped": True}
        except Exception as exc:
            print(f"[ingest] Could not check collection: {exc}", flush=True)

    # Load agents from PostgreSQL
    from database import SessionLocal
    from models import HistoricalAgent

    db = SessionLocal()
    try:
        agents = (
            db.query(HistoricalAgent).filter(HistoricalAgent.isActive.is_(True)).all()
        )
    finally:
        db.close()

    if not agents:
        print("[ingest] No active agents in database — nothing to ingest.", flush=True)
        return {"agents": 0, "chunks": 0}

    print(f"[ingest] Loaded {len(agents)} agents from PostgreSQL.", flush=True)

    # Clear stale data so queries don't return old zero-vector junk
    try:
        rag.vector_store.client.delete_collection(COLLECTION_NAME)
        print(f"[ingest] Cleared stale '{COLLECTION_NAME}' collection.", flush=True)
    except Exception:
        pass  # Didn't exist yet — that's fine

    # Build chunks
    documents: List[str] = []
    metadatas: List[dict] = []
    ids: List[str] = []

    for agent in agents:
        text = _build_document(agent)
        if not text.strip():
            continue
        for i, chunk in enumerate(_chunk_text(text)):
            documents.append(chunk)
            metadatas.append(
                {"agentId": agent.agentId, "name": agent.name, "chunk_index": i}
            )
            ids.append(f"{agent.agentId}--{i}")

    print(f"[ingest] Storing {len(documents)} chunks for {len(agents)} agents...", flush=True)

    # Ingest in batches of 100 to keep individual OpenAI embedding calls reasonable
    BATCH = 100
    collection = rag.vector_store.get_or_create_collection(COLLECTION_NAME)
    for start in range(0, len(documents), BATCH):
        end = min(start + BATCH, len(documents))
        collection.add(
            documents=documents[start:end],
            metadatas=metadatas[start:end],
            ids=ids[start:end],
        )
        print(f"[ingest]   {end}/{len(documents)} chunks stored.", flush=True)

    final_count = collection.count()
    print(
        f"[ingest] Done — {final_count} chunks in '{COLLECTION_NAME}'.",
        flush=True,
    )
    return {"agents": len(agents), "chunks": final_count}


if __name__ == "__main__":
    force = "--force" in sys.argv
    result = run_ingest(force=force)
    print(f"[ingest] Summary: {result}")
