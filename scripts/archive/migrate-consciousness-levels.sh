#!/bin/bash
# Migrate from consciousness levels to objective metrics

# Find all agent files that use the old level system
for file in lib/agents/enlightenment-agents.ts lib/agents/modern-agents.ts; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # This is just a check - manual updates needed for complex TypeScript
    grep -n "level:" "$file" | head -5
  fi
done
