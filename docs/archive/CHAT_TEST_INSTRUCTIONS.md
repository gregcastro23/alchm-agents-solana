# 🧪 Chat Testing Instructions

## ✅ API Keys Are Configured

I've added all your API keys to `.env.local`:

- ✅ Anthropic Claude API (Primary)
- ✅ OpenAI GPT API (Backup)
- ✅ Galileo API (Observability)

The same keys are configured in Vercel for production.

## 🧪 How to Test Chat Locally

### Option 1: Browser Testing (Recommended)

1. **Go to**: http://localhost:3000

2. **Test Monica Chat Bubble**:
   - Look at bottom-right corner
   - Click the green chat bubble
   - Type: "Hello Monica! Tell me about alchm"
   - You should get a response from Monica

3. **Test Agent Chat**:
   - Navigate to: http://localhost:3000/gallery
   - Click on any agent (e.g., "Isaac Asimov")
   - Type a message: "Tell me about the Foundation series"
   - You should get a response

4. **Test Planetary Agents**:
   - Navigate to: http://localhost:3000/planetary-agents
   - Select a planet and click "Consult"
   - Type your question
   - You should get planetary wisdom

### Option 2: API Testing

```bash
# Test the chat API directly
curl -X POST http://localhost:3000/api/unified-multi-agent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "agents": [{
      "id": "leonardo-da-vinci",
      "name": "Leonardo da Vinci",
      "type": "historical"
    }],
    "message": "Hello Leonardo!",
    "context": {
      "sessionHistory": [],
      "enableMemoryPersistence": false,
      "realtimeUpdates": false
    }
  }'
```

## 🌐 Test Production (Vercel)

1. **Go to**: https://planetary-agents.vercel.app/

2. **Same tests as above** - The production site should work identically

3. **Verify**:
   - Monica chat bubble works
   - Agent chats work
   - Planetary consultations work

## 🔍 Troubleshooting

### If Chat Doesn't Work:

1. **Check API Keys Are Loaded**:

```bash
# In dev terminal, you should see:
# - No errors about missing API keys
# - Environment variables loaded
```

2. **Check Browser Console**:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for any red errors
   - Report them if you see any

3. **Restart Dev Server**:

```bash
pkill -f "next dev"
cd /Users/GregCastro/Desktop/planetary-agents
yarn dev
```

4. **Check Environment Variables**:

```bash
cat .env.local | grep API_KEY
# Should show your Anthropic and OpenAI keys
```

## ✅ Expected Behavior

### Working Chat Should:

- ✅ Respond within 2-10 seconds
- ✅ Give personality-appropriate responses
- ✅ Remember conversation context
- ✅ Show agent's consciousness stats
- ✅ Display typing indicators

### Common Issues:

1. **"Please configure API keys"**:
   - Server needs restart
   - Run: `pkill -f "next dev" && yarn dev`

2. **Error 500**:
   - Check console logs
   - Verify agent exists in DEMO_AGENTS

3. **No response**:
   - API rate limit hit
   - Try different agent or wait 1 minute

## 📊 Monitor API Usage

- **Anthropic**: https://console.anthropic.com/
- **OpenAI**: https://platform.openai.com/usage
- **Galileo**: https://www.galileo.ai/

## 🎯 Next Steps After Testing

If everything works:

1. ✅ Mark this as complete
2. ✅ Document any issues found
3. ✅ Test all 35+ agents if desired
4. ✅ Test multi-agent council chat
5. ✅ Test planetary group chats

**Let me know what you find when you test!** 🚀
