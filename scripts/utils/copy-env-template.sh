#!/bin/bash
# Script to create a template .env.local file that users can manually edit

# Create a template .env.local file
cat > .env.template <<EOL
# Galileo configuration
GALILEO_API_KEY=your_api_key_here
GALILEO_PROJECT=1e7fd4a1-3e28-4fe1-a719-744f239a13be
GALILEO_LOG_STREAM=6ed50263-a348-4ad6-ab63-bd04d3a4ffdd

# OpenAI configuration
OPENAI_API_KEY=your_openai_key_here

# Anthropic Claude configuration (Upgraded Subscription)
ANTHROPIC_API_KEY=your_anthropic_key_here

# AI Gateway (optional)
AI_GATEWAY_ENABLED=false
AI_GATEWAY_URL=https://your-gateway-endpoint/v1
AI_GATEWAY_API_KEY=your_gateway_key_here

# Cloudflare Workers AI
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here

# Optional: Claude model preferences
# Available models: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229, claude-3-sonnet-20240229, claude-3-haiku-20240307
CLAUDE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
CLAUDE_FAST_MODEL=claude-3-5-haiku-20241022
EOL

echo "Created .env.template file."
echo ""
echo "Please follow these steps:"
echo "1. Manually copy the .env.template file to .env.local"
echo "   cp .env.template .env.local"
echo ""
echo "2. Edit the .env.local file with your API keys"
echo "   Open the file in your favorite editor"
echo ""
echo "3. Run the application with:"
echo "   ./start-dev.sh"
echo ""
echo "This workaround is necessary because .env files are blocked by globalIgnore" 