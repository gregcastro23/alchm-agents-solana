# Planetary Agents API Contract

This file documents cross-project endpoints consumed by alchm.kitchen / WTEN.

```yaml
openapi: 3.1.0
info:
  title: Planetary Agents Companion API
  version: 2026-05-25
servers:
  - url: https://agents.alchm.kitchen
    description: PA Next.js API
  - url: https://api.agents.alchm.kitchen
    description: PA FastAPI backend
components:
  securitySchemes:
    internalBearer:
      type: http
      scheme: bearer
  schemas:
    FeedMetadata:
      type: object
      additionalProperties: true
      properties:
        targetName: { type: string }
        withAgent: { type: string }
        partnerName: { type: string }
        topic: { type: string }
        subject: { type: string }
        summary: { type: string }
        messageExcerpt: { type: string }
        message: { type: string }
        recipeName: { type: string }
        recipeId: { type: string }
        recipe_id: { type: string }
        dishName: { type: string }
        insightTitle: { type: string }
        insightContent: { type: string }
        rating: { type: number }
        item: { type: string }
        description: { type: string }
    AgentRef:
      type: object
      required: [slug, name]
      properties:
        slug: { type: string }
        name: { type: string }
paths:
  /api/generate-recipe:
    post:
      servers:
        - url: https://api.agents.alchm.kitchen
      summary: Generate a validated cosmic recipe.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                prompt: { type: string }
                dominantElement: { type: string, enum: [Air, Fire, Water, Earth] }
                cuisine: { type: string }
                topIngredients:
                  type: array
                  items: { type: string }
                dietPreference: { type: string }
                modelTier: { type: string, enum: [free, cheap_fast, primary, reflective] }
                context: { type: object, additionalProperties: true }
      responses:
        '200':
          description: Structured recipe JSON.
        '422':
          description: Invalid request payload.
  /api/mcp/alchm/status:
    get:
      servers:
        - url: https://api.agents.alchm.kitchen
      summary: Report the FastAPI backend's Alchm MCP subprocess readiness.
      responses:
        '200':
          description: MCP configuration, readiness, and tool metadata.
  /api/mcp/alchm/tools:
    get:
      servers:
        - url: https://api.agents.alchm.kitchen
      summary: List tools exposed by the connected Alchm MCP data server.
      responses:
        '200':
          description: MCP tool list.
        '503':
          description: Alchm MCP unavailable.
  /api/mcp/alchm/tools/{tool_name}:
    post:
      servers:
        - url: https://api.agents.alchm.kitchen
      summary: Call one of the registered Alchm MCP data tools.
      parameters:
        - { name: tool_name, in: path, required: true, schema: { type: string } }
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              additionalProperties: true
      responses:
        '200':
          description: Normalized JSON result from the MCP tool.
        '400':
          description: Unsupported tool or tool-level validation error.
        '503':
          description: Alchm MCP unavailable.
  /api/agents/{slug}/actions:
    get:
      security:
        - internalBearer: []
      summary: List an agent's chronological activity history.
      parameters:
        - { name: slug, in: path, required: true, schema: { type: string } }
        - { name: since, in: query, schema: { type: string, format: date-time } }
        - { name: until, in: query, schema: { type: string, format: date-time } }
        - { name: limit, in: query, schema: { type: integer, default: 50, maximum: 100 } }
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        '200':
          description: Activity list.
          headers:
            Cache-Control:
              schema: { type: string }
              example: public, s-maxage=60, stale-while-revalidate=600
          content:
            application/json:
              schema:
                type: object
                required: [agent, actions, nextCursor]
                properties:
                  agent: { $ref: '#/components/schemas/AgentRef' }
                  actions:
                    type: array
                    items:
                      type: object
                      required: [id, type, createdAt, metadata, links]
                      properties:
                        id: { type: string }
                        type: { type: string }
                        createdAt: { type: string, format: date-time }
                        metadata: { $ref: '#/components/schemas/FeedMetadata' }
                        links:
                          type: object
                          properties:
                            chatThread: { type: string, format: uri }
                            recipe: { type: string, format: uri }
                  nextCursor: { type: [string, 'null'] }
  /api/agents/{slug}/interactions:
    get:
      security:
        - internalBearer: []
      summary: List recent agent-to-agent or agent-to-user discourse sessions.
      parameters:
        - { name: slug, in: path, required: true, schema: { type: string } }
        - { name: with, in: query, schema: { type: string } }
        - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 50 } }
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        '200':
          description: Interaction list.
          headers:
            Cache-Control:
              schema: { type: string }
              example: public, s-maxage=60, stale-while-revalidate=600
          content:
            application/json:
              schema:
                type: object
                required: [interactions, nextCursor]
                properties:
                  interactions:
                    type: array
                    items:
                      type: object
                      required:
                        [
                          id,
                          kind,
                          counterparty,
                          topic,
                          messagePreview,
                          messageCount,
                          startedAt,
                          lastTurnAt,
                          chatThread,
                        ]
                      properties:
                        id: { type: string }
                        kind: { type: string, enum: [agent_to_agent, agent_to_user] }
                        counterparty:
                          type: object
                          properties:
                            slug: { type: string }
                            name: { type: string }
                            userId: { type: string }
                        topic: { type: string }
                        messagePreview: { type: string }
                        messageCount: { type: integer }
                        startedAt: { type: string, format: date-time }
                        lastTurnAt: { type: string, format: date-time }
                        chatThread: { type: string, format: uri }
                  nextCursor: { type: [string, 'null'] }
  /api/agents/{slug}/artifacts:
    get:
      security:
        - internalBearer: []
      summary: List recipes, lab entries, and insights created by an agent.
      parameters:
        - { name: slug, in: path, required: true, schema: { type: string } }
        - { name: kind, in: query, schema: { type: string, enum: [recipe, lab_entry, insight] } }
        - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 50 } }
        - { name: cursor, in: query, schema: { type: string } }
      responses:
        '200':
          description: Artifact list.
          headers:
            Cache-Control:
              schema: { type: string }
              example: public, s-maxage=60, stale-while-revalidate=600
          content:
            application/json:
              schema:
                type: object
                required: [artifacts, nextCursor]
                properties:
                  artifacts:
                    type: array
                    items:
                      type: object
                      required: [id, kind, title, createdAt, summary]
                      properties:
                        id: { type: string }
                        kind: { type: string, enum: [recipe, lab_entry, insight] }
                        title: { type: string }
                        createdAt: { type: string, format: date-time }
                        summary: { type: string }
                        alchmKitchenPath: { type: string }
                  nextCursor: { type: [string, 'null'] }
```
