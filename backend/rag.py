"""
RAG vector store wrapper around ChromaDB.

The embedding function default is OpenAI text-embedding-3-small (cheap,
high-quality, no torch dependency). Chroma v0.5+ requires
EmbeddingFunction implementations to provide `name()`, `get_config()`,
and `build_from_config()` — the previous DummyEmbeddingFunction lacked
`name`, which caused every RAG query to raise
`'DummyEmbeddingFunction' object has no attribute 'name'` and silently
return no chunks.

If OPENAI_API_KEY is unset we fall back to a ZeroEmbeddingFunction that
satisfies the Chroma interface but returns zero vectors. Retrieval is
useless under that fallback, but Chroma stops crashing — so chat keeps
working on persona-only.

NOTE: Existing collections that were populated under the old
DummyEmbeddingFunction contain zero-vector embeddings. After deploying
this change you must re-ingest agent knowledge (`bun run sync:chromadb`
from the repo root) for queries to retrieve anything meaningful.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./chroma_db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")


class OpenAIEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    Calls OpenAI's embeddings endpoint. Cost is ~$0.02 / million tokens
    for text-embedding-3-small — effectively free at our query volume.
    """

    def __init__(self, api_key: str, model: str = EMBEDDING_MODEL):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self._model = model

    def __call__(self, input: Documents) -> Embeddings:
        if not input:
            return []
        resp = self._client.embeddings.create(model=self._model, input=list(input))
        return [d.embedding for d in resp.data]

    @staticmethod
    def name() -> str:
        return "openai_text_embedding_3_small"

    def get_config(self) -> Dict[str, Any]:
        return {"model": self._model}

    @staticmethod
    def build_from_config(config: Dict[str, Any]) -> "OpenAIEmbeddingFunction":
        return OpenAIEmbeddingFunction(
            api_key=os.environ["OPENAI_API_KEY"],
            model=config.get("model", EMBEDDING_MODEL),
        )

    @staticmethod
    def validate_config(config: Dict[str, Any]) -> None:
        return None


class ZeroEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    Last-resort fallback when no embedding API key is configured.
    Returns 384-dim zero vectors — Chroma stops crashing but retrieval
    is meaningless. Chat still works because RAG augmentation is
    optional in /api/chat.
    """

    DIM = 384

    def __call__(self, input: Documents) -> Embeddings:
        return [[0.0] * self.DIM for _ in input]

    @staticmethod
    def name() -> str:
        return "zero_fallback"

    def get_config(self) -> Dict[str, Any]:
        return {"dim": self.DIM}

    @staticmethod
    def build_from_config(config: Dict[str, Any]) -> "ZeroEmbeddingFunction":
        return ZeroEmbeddingFunction()

    @staticmethod
    def validate_config(config: Dict[str, Any]) -> None:
        return None


def _select_embedding_function() -> EmbeddingFunction:
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        return OpenAIEmbeddingFunction(api_key=api_key)
    print(
        "RAG warning: OPENAI_API_KEY unset — using ZeroEmbeddingFunction. "
        "Retrieval will return no useful matches until a key is configured.",
        flush=True,
    )
    return ZeroEmbeddingFunction()


class VectorStore:
    def __init__(self):
        self._client = None
        self._embedding_fn: Optional[EmbeddingFunction] = None

    @property
    def client(self):
        if self._client is None:
            self._client = chromadb.PersistentClient(path=CHROMADB_PATH)
        return self._client

    @property
    def embedding_fn(self) -> EmbeddingFunction:
        if self._embedding_fn is None:
            self._embedding_fn = _select_embedding_function()
        return self._embedding_fn

    def get_or_create_collection(self, name: str):
        return self.client.get_or_create_collection(
            name=name, embedding_function=self.embedding_fn
        )

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str],
    ):
        collection = self.get_or_create_collection(collection_name)
        collection.add(documents=documents, metadatas=metadatas, ids=ids)

    def query(
        self,
        collection_name: str,
        query_text: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
    ):
        collection = self.get_or_create_collection(collection_name)
        return collection.query(
            query_texts=[query_text], n_results=n_results, where=where
        )


vector_store = VectorStore()
