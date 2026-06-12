# Cursor MCP Setup Instructions for Render Integration

## Overview

This guide will help you integrate the Render MCP server into Cursor, enabling you to manage your Render infrastructure directly from Cursor using natural language prompts.

The Render MCP server is hosted at `https://mcp.render.com/mcp` and provides access to:

- Service management (create, list, query services)
- Database operations (PostgreSQL queries, management)
- Metrics and monitoring (CPU, memory, response times)
- Logs and troubleshooting
- Deploy history and details
- Key Value (Redis) instances

## Prerequisites

- Cursor IDE installed
- Render account with API access
- Render API Key (create from [Account Settings](https://dashboard.render.com/settings#api-keys))

<warning-block>

**Render API keys are broadly scoped.** They grant access to all workspaces and services your account can access. Before proceeding, make sure you're comfortable granting these permissions to your AI app.

</warning-block>

## Setup Instructions

### Step 1: Create an API Key

1. Navigate to your [Render Account Settings](https://dashboard.render.com/settings#api-keys)
2. Click "Create API Key"
3. Copy and save the API key securely (you won't be able to see it again)

### Step 2: Configure Cursor MCP

**Option A: Use Project Configuration (Recommended for this project)**

This project includes a pre-configured MCP settings file at `.cursor/mcp_settings.json`. The Render MCP server is already configured to use an environment variable:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer ${RENDER_API_KEY}"
      }
    }
  }
}
```

**To activate:**

1. Set the `RENDER_API_KEY` environment variable in your shell or `.env.local`
2. Restart Cursor completely

**Option B: Use Global Cursor Configuration**

The Cursor MCP configuration file is located at:

```
~/.cursor/mcp.json
```

If this file doesn't exist, you'll need to create it. Add the following configuration:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

Replace `<YOUR_API_KEY>` with your Render API key.

**If you already have other MCP servers configured**, merge the `render` configuration into your existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "url": "https://example.com/mcp"
    },
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

### Step 3: Restart Cursor

After saving the configuration file, **completely restart Cursor** for the MCP server to be recognized.

### Step 4: Set Your Render Workspace

Once Cursor restarts, the first thing you need to do is set your active Render workspace. Use a prompt like:

```
Set my Render workspace to [YOUR_WORKSPACE_NAME]
```

If you don't know your workspace name, you can ask:

```
List all my Render workspaces
```

## Available Commands & Examples

Once configured, you can use natural language prompts to interact with Render:

### Service Management

```
List my Render services
Show details for service [service-name]
Create a new web service using https://github.com/render-examples/flask-hello-world
```

### Database Operations

```
List all my Render databases
Create a new database named user-db with 5 GB storage
Query my database for the top 10 users by signup date
Run this SQL query on my production database: SELECT COUNT(*) FROM users
```

### Monitoring & Logs

```
Pull the most recent error-level logs for my API service
What was the busiest traffic day for my service this month?
Show me CPU usage for my web service over the last 24 hours
What did my service's autoscaling behavior look like yesterday?
```

### Analytics & Troubleshooting

```
Using my Render database, tell me which items were the most frequently bought together
Query my read replica for daily signup counts for the last 30 days
Why isn't my site at example.onrender.com working?
```

### Environment Variables

```
Update environment variables for [service-name]
Show current environment variables for my API service
```

## Supported Render Resources

The Render MCP server supports the following operations:

### ✅ Workspaces

- List all workspaces
- Set current workspace
- Fetch workspace details

### ✅ Services

- Create web services and static sites
- List all services
- Retrieve service details
- Update environment variables

### ✅ Deploys

- List deploy history
- Get deploy details

### ✅ Logs

- List logs with filters
- List log label values

### ✅ Metrics

- CPU/memory usage
- Instance count
- Database connections
- Response counts by status code
- Response times (Professional workspace required)
- Outbound bandwidth

### ✅ PostgreSQL Databases

- Create databases
- List databases
- Get database details
- Run read-only SQL queries

### ✅ Key Value (Redis)

- List Key Value instances
- Get instance details
- Create new instances

## Limitations

⚠️ **Important limitations to be aware of:**

1. **API Key Scope**: The Render API key grants access to ALL workspaces and services your account can access. Use with caution.

2. **Service Types**: Only web services and static sites can be created. Background workers, cron jobs, and private services are not yet supported.

3. **Free Instances**: Cannot create free-tier instances via MCP.

4. **Destructive Operations**: Limited to modifying environment variables. Cannot delete resources or trigger deploys via MCP.

5. **Secrets Exposure**: While the MCP server attempts to minimize exposing sensitive information, Render does not guarantee secrets won't be exposed in AI context.

## Troubleshooting

### Configuration Not Working

1. Verify the file path is correct: `~/.cursor/mcp.json`
2. Ensure JSON syntax is valid (use a JSON validator)
3. Completely restart Cursor (not just reload window)
4. Check Cursor's developer console for MCP errors

### API Key Issues

If you get authentication errors:

1. Verify the API key is correct
2. Check that the key hasn't been revoked in your Render dashboard
3. Ensure there are no extra spaces or characters in the key

### Workspace Not Set

If you get "workspace not set" errors:

1. Always set your workspace first: `Set my Render workspace to [name]`
2. You can list available workspaces: `List all my Render workspaces`

## Security Best Practices

1. **Protect Your API Key**: Never commit `mcp.json` to version control
2. **Limit Scope**: Consider creating a dedicated Render account with limited access for AI integrations
3. **Monitor Usage**: Regularly check your Render dashboard for unexpected changes
4. **Review Actions**: Always review what the AI plans to do before confirming destructive operations

## Additional Resources

- [Render MCP Documentation](https://docs.render.com/mcp)
- [Render API Documentation](https://api-docs.render.com/)
- [Cursor MCP Documentation](https://docs.cursor.com/mcp)
- [Render MCP GitHub Repository](https://github.com/render-oss/render-mcp-server)

## Project-Specific Context

This Planetary Agents project currently has services deployed on Render:

### Current Deployment

- **Frontend**: Next.js application
- **Database**: Neon PostgreSQL (connection string in `.env.local`)
- **Potential Render Services**: Backend gateway, API services

### Environment Variables to Consider

When creating or updating Render services for this project, ensure these variables are set:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (Neon PostgreSQL)
- `REDIS_URL` (if using Redis)
- `NEXT_PUBLIC_ADDITIVE_ONLY_ELEMENTS`

### Useful Commands for This Project

```
List my Render services and show their deployment status
Show me the latest logs from my planetary-agents service
What's the CPU and memory usage for my frontend service?
Update environment variables for my planetary-agents service
```

## Quick Start Checklist

- [ ] Create Render API key from [Account Settings](https://dashboard.render.com/settings#api-keys)
- [ ] Set `RENDER_API_KEY` environment variable (or use global config)
- [ ] Verify configuration in `.cursor/mcp_settings.json` (project) or `~/.cursor/mcp.json` (global)
- [ ] Restart Cursor completely
- [ ] Set your Render workspace: `Set my Render workspace to [WORKSPACE_NAME]`
- [ ] Test with: `List my Render services`
- [ ] Explore with natural language prompts

## What is MCP?

[**Model Context Protocol**](https://modelcontextprotocol.io/introduction) (**MCP**) is an open standard for connecting AI applications to external tools and data. An **MCP server** exposes a set of actions that AI apps can invoke to help fulfill relevant user prompts.

The Render MCP server calls the Render API to perform platform actions, then packages the results into a standardized format for Cursor.

## How It Works

1. You provide a natural language prompt (e.g., "List my Render services")
2. Cursor intelligently detects that the Render MCP server supports actions relevant to the prompt
3. Cursor directs the MCP server to execute the appropriate tool (e.g., `list_services`)
4. The MCP server calls the Render API and returns the results
5. Cursor displays the information in a helpful format

## Running Locally (Advanced)

<info-block>

**We strongly recommend using Render's hosted MCP server** instead of running it locally. The hosted server automatically updates with new capabilities as they're added.

</info-block>

If you need to run the MCP server locally, see the [official documentation](https://docs.render.com/mcp#running-locally) for Docker and executable setup options.

---

**Setup Date**: 2025-10-29  
**Configuration File**: `.cursor/mcp_settings.json` (project) or `~/.cursor/mcp.json` (global)  
**MCP Server URL**: `https://mcp.render.com/mcp`  
**Documentation**: [Render MCP Docs](https://docs.render.com/mcp)  
**Source Code**: [GitHub Repository](https://github.com/render-oss/render-mcp-server)
