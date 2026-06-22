# n8n Workflow Advisor -- Slack Agent

A Slack agent that returns ready-to-import n8n workflow JSONs on demand. Built for the Slack Agent Builder Hackathon 2026.

## What it does

User types in Slack: "I need a workflow for client onboarding"

Agent responds with:
- The best matching n8n automation pack
- A sample workflow JSON ready to import
- Setup instructions
- Link to the full pack

## Architecture

- **Bolt JS** -- Slack event handler (socket mode)
- **MCP server** (`mcp-server.js`) -- exposes n8n catalog as MCP tools: `list_packs`, `search_packs`, `get_workflow`
- **Claude Haiku** -- matches user request to the right automation pack
- **33 workflow JSONs** -- one per industry vertical, ready to import into n8n

## Setup

### 1. Create Slack App

1. Go to api.slack.com/apps > Create New App > From manifest
2. Use the manifest in `slack-manifest.yml`
3. Install to your workspace
4. Copy Bot Token, App Token, Signing Secret to `.env`

### 2. Environment

```bash
cp .env.example .env
# Fill in your tokens
```

### 3. Install and run

```bash
npm install
npm start
```

### 4. Using the agent

- Mention the bot: `@n8n-advisor I need a booking confirmation workflow for my restaurant`
- Use the slash command: `/n8nflow HR onboarding automation`
- Send it a DM

## MCP Server

The MCP server runs as a separate process (stdio transport) and can be connected to any MCP-compatible client:

```bash
node mcp-server.js
```

Tools exposed:
- `list_packs` -- returns all 33 pack metadata
- `search_packs(query)` -- keyword/industry search
- `get_workflow(pack_id)` -- returns workflow JSON + setup instructions

## Hackathon

- Track: New Slack Agent (Track 1)
- Qualifies via: MCP server integration + Claude AI reasoning
- Special prizes targeted: Best Technical Implementation, Most Innovative
