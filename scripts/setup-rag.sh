#!/bin/bash

# RAG Setup Script for Planetary Agents
# This script sets up the RAG infrastructure

set -e

echo "=========================================="
echo "Planetary Agents - RAG Setup"
echo "=========================================="
echo ""

# Check if ChromaDB is running
echo "[1/4] Checking ChromaDB..."
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✓ ChromaDB is running"
else
    echo "✗ ChromaDB is not running"
    echo ""
    echo "Please start ChromaDB first:"
    echo "  docker run -p 8000:8000 chromadb/chroma"
    echo ""
    echo "Or install and run with Python:"
    echo "  pip install chromadb"
    echo "  chroma run --host localhost --port 8000"
    echo ""
    exit 1
fi

# Check environment variables
echo ""
echo "[2/4] Checking environment variables..."
if [ -f .env.local ]; then
    if grep -q "CHROMADB_URL" .env.local; then
        echo "✓ Environment configured"
    else
        echo "✗ Missing RAG configuration in .env.local"
        echo "Please add RAG configuration to .env.local"
        exit 1
    fi
else
    echo "✗ .env.local not found"
    exit 1
fi

# Check if Next.js is running
echo ""
echo "[3/4] Checking Next.js server..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Next.js is running"
    NEXTJS_RUNNING=true
else
    echo "⚠ Next.js is not running"
    echo "  You'll need to start it with: yarn dev"
    NEXTJS_RUNNING=false
fi

# Ingest agent knowledge
echo ""
echo "[4/4] Ingesting agent knowledge..."
if [ "$NEXTJS_RUNNING" = true ]; then
    echo "Using API endpoint..."
    response=$(curl -s -X POST http://localhost:3000/api/vector-store/ingest \
      -H "Content-Type: application/json" \
      -d '{"action": "ingest"}')

    if echo "$response" | grep -q "success"; then
        echo "✓ Agent knowledge ingested successfully"
    else
        echo "✗ Ingestion failed"
        echo "$response"
        exit 1
    fi
else
    echo "Using CLI script..."
    npx tsx lib/llamaindex/ingestion-pipeline.ts
fi

echo ""
echo "=========================================="
echo "RAG Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Test semantic search:"
echo "     curl -X POST http://localhost:3000/api/agents/semantic-search \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"concept\": \"creativity\", \"topK\": 3}'"
echo ""
echo "  2. Query vector store:"
echo "     curl 'http://localhost:3000/api/vector-store/query?query=wisdom&topK=5'"
echo ""
echo "  3. Enable RAG in agent chat (coming soon)"
echo ""
