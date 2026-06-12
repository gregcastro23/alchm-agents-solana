#!/bin/bash

# Directory containing agent files
AGENT_DIR="lib/agents/historical"

# Count files that need updating
echo "Checking agent files for 'level:' usage..."
grep -l "level:" "$AGENT_DIR"/*.ts | wc -l
echo "files need updating"

echo ""
echo "First 5 files that need updating:"
grep -l "level:" "$AGENT_DIR"/*.ts | head -5

