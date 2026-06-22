# DevPost Submission -- n8n Workflow Advisor

## Tagline
Get a ready-to-import n8n automation workflow in Slack -- just describe what you need.

## What it does

n8n Workflow Advisor is a Slack agent that turns plain-English requests into ready-to-import n8n workflow JSON files. Your team types what they need to automate; the agent returns the right workflow template, correctly formatted, with step-by-step setup instructions.

**Example interactions:**

- `@n8n-advisor I need to automate invoice reminders for overdue clients` -- returns Freelancer Automation workflow JSON
- `/n8nflow customer onboarding email sequence` -- returns Customer Onboarding pack sample
- `@n8n-advisor restaurant reservation confirmations` -- returns Restaurant + Hospitality workflow

The agent covers 33 business verticals: agencies, bookkeeping, dental clinics, e-commerce, healthcare, HR, IT service desks, legal practices, real estate, restaurants, SaaS, and more.

## How it was built

**Architecture:**

```
User in Slack
     |
Bolt JS App (Socket Mode)
     |
     +-- /n8nflow command
     +-- @app_mention event
     +-- DM handler
     |
Claude Haiku (via Anthropic API)
  - Receives user request + pack catalog
  - Returns: { pack_id, confidence, reason }
     |
MCP Server (mcp-server.js)
  Tools: list_packs | search_packs | get_workflow
     |
Workflow Catalog (33 JSON files)
  - One per business vertical
  - Ready to import into n8n
     |
Slack response: pack description + JSON + setup guide + Payhip link
```

**Tech stack:**
- Slack Bolt JS (socket mode -- no public URL needed)
- Model Context Protocol SDK -- exposes the workflow catalog as MCP tools
- Anthropic Claude Haiku -- intent matching (fast, cost-efficient)
- Node.js 18+

**MCP integration:**
The MCP server (`mcp-server.js`) exposes three tools: `list_packs`, `search_packs(query)`, and `get_workflow(pack_id)`. This server can be connected to any MCP-compatible client (Claude Desktop, Cursor, Continue) in addition to the Slack agent -- making the workflow library accessible across the entire AI toolchain.

## Challenges

The main challenge was building a reliable intent-matching layer without overengineering it. A vector-search setup would be accurate but requires a database. A pure keyword search misses synonyms and context. We landed on a hybrid: keyword pre-scoring narrows the candidate list, then Claude does the final semantic match. This runs in under 800ms on average.

The second challenge was Slack's block formatting limit (3000 chars per block) -- workflow JSONs can be large. We truncate the preview at 2800 chars and always include the full-pack link for the complete set of workflows.

## Accomplishments

- 33 fully functional workflow JSON files, covering every major business vertical
- MCP server that works standalone (other AI tools can query the catalog directly)
- Hybrid matching that handles synonyms: "booking system" correctly matches "reservation automation"
- Zero infrastructure required -- socket mode means no webhooks, no public URLs, deploys anywhere Node runs

## What's next

- Add workflow customisation: "adjust the invoice reminder to send after 14 days, not 7"
- Connect to n8n's official template library via API for live updates
- Slack App Directory listing (Track 3 submission for future hackathon cycle)
- Australian-specific workflow verticals: NDIS providers, tradie businesses, strata management

## Built with

- node.js
- @slack/bolt
- @anthropic-ai/sdk
- @modelcontextprotocol/sdk
- n8n (workflow format)
