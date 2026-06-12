#!/bin/bash
# Script to start the development server with proper Galileo environment variables

# Set environment variables
export GALILEO_PROJECT="1e7fd4a1-3e28-4fe1-a719-744f239a13be"
export GALILEO_LOG_STREAM="6ed50263-a348-4ad6-ab63-bd04d3a4ffdd"

# Prompt for API key if not already set
if [ -z "$GALILEO_API_KEY" ]; then
  echo "Please enter your Galileo API key:"
  read -s GALILEO_API_KEY
  export GALILEO_API_KEY
fi

echo ""
echo "Starting development server with Galileo configuration:"
echo "Project ID: $GALILEO_PROJECT"
echo "Log Stream: $GALILEO_LOG_STREAM"
echo "API Key is set: $([ -n "$GALILEO_API_KEY" ] && echo "Yes" || echo "No")"
echo ""

# Start the development server
yarn dev 