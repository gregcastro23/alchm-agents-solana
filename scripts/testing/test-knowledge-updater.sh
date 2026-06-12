#!/bin/bash

# Test script for Knowledge Updater API
# Tests web content ingestion with Plato agent

echo "🧪 Testing Knowledge Updater API - Web Content Ingestion"
echo "========================================================"
echo ""

# Test 1: Web content ingestion
echo "📥 Test 1: Ingest content from Stanford Encyclopedia of Philosophy"
echo "URL: https://plato.stanford.edu/entries/plato/"
echo ""

curl -X POST http://localhost:3000/api/knowledge-updater \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "plato",
    "urls": ["https://plato.stanford.edu/entries/plato/"],
    "type": "web"
  }' \
  2>/dev/null | jq '.'

echo ""
echo "========================================================"
echo ""

# Test 2: Query recent updates
echo "📋 Test 2: Query recent knowledge updates for Plato"
echo ""

curl -X GET "http://localhost:3000/api/knowledge-updater?agentId=plato&limit=5" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'

echo ""
echo "========================================================"
echo "✅ Testing complete!"
