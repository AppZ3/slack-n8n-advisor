# Architecture: n8n Workflow Advisor

```
User in Slack
     |
     |-- @n8n Advisor [request]
     |-- /n8nflow [request]
     |-- DM [request]
     |
     v
┌─────────────────────────────────┐
│       Slack Bolt App (Node.js)  │
│       Socket Mode (no webhooks) │
│                                 │
│  event: app_mention             │
│  command: /n8nflow              │
│  event: message (DM)            │
│  event: app_home_opened         │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│    Claude Haiku (Anthropic API) │
│                                 │
│  Input: user request + catalog  │
│  Output: { pack_id, reason }    │
│  ~800ms / ~$0.002 per query     │
└────────────┬────────────────────┘
             │  pack_id
             v
┌─────────────────────────────────┐
│         MCP Server              │
│         (mcp-server.js)         │
│                                 │
│  Tools:                         │
│  • list_packs()                 │
│  • search_packs(query)          │
│  • get_workflow(pack_id)        │
│                                 │
│  Transport: stdio (JSON-RPC)    │
└────────────┬────────────────────┘
             │  workflow JSON
             v
┌─────────────────────────────────┐
│     n8n Workflow Catalog        │
│     33 JSON files               │
│                                 │
│  agency, bookkeeping, dental    │
│  ecommerce, healthcare, HR      │
│  legal, restaurant, saas ...    │
└─────────────────────────────────┘
             │
             v
┌─────────────────────────────────┐
│     Slack Response              │
│                                 │
│  - Pack name + description      │
│  - Sample workflow JSON (code)  │
│  - Setup instructions (4 steps) │
│  - Full pack link (Payhip)      │
└─────────────────────────────────┘
```

## MCP server standalone usage

The MCP server also works independently -- connect it to Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "n8n-advisor": {
      "command": "node",
      "args": ["/path/to/slack-n8n-advisor/mcp-server.js"]
    }
  }
}
```

Then call `list_packs`, `search_packs("restaurant booking")`, or `get_workflow("restaurant")` from any MCP client.

## Tech stack

| Component | Technology |
|-----------|-----------|
| Slack integration | @slack/bolt v4 (socket mode) |
| AI matching | @anthropic-ai/sdk, Claude Haiku |
| MCP server | @modelcontextprotocol/sdk v1.29 |
| Workflow data | 33 n8n JSON files |
| Runtime | Node.js 18+ |
| Config | .env (SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET, ANTHROPIC_API_KEY) |
