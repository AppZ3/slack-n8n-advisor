const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const { PACKS } = require('./catalog.js');

const server = new McpServer({
  name: 'n8n-workflow-advisor',
  version: '1.0.0',
});

server.tool(
  'list_packs',
  'List all available n8n automation packs with their industries and use cases',
  {},
  async () => {
    const summary = PACKS.map(p => ({
      id: p.id,
      name: p.name,
      industries: p.industries,
      description: p.description,
      price: p.price,
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  'search_packs',
  'Search n8n automation packs by industry, use case, or keywords',
  { query: z.string().describe('Search query: industry name, workflow type, or use case description') },
  async ({ query }) => {
    const q = query.toLowerCase();
    const scored = PACKS.map(pack => {
      let score = 0;
      if (pack.industries.some(i => q.includes(i) || i.includes(q))) score += 3;
      if (pack.keywords.some(k => q.includes(k) || k.includes(q))) score += 2;
      if (pack.name.toLowerCase().includes(q)) score += 2;
      if (pack.description.toLowerCase().includes(q)) score += 1;
      return { pack, score };
    });
    const matches = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => ({
        id: s.pack.id,
        name: s.pack.name,
        description: s.pack.description,
        price: s.pack.price,
        url: s.pack.url,
        relevance: s.score,
      }));
    return {
      content: [{ type: 'text', text: JSON.stringify(matches, null, 2) }],
    };
  }
);

server.tool(
  'get_workflow',
  'Get the n8n workflow JSON for a specific pack by its ID',
  { pack_id: z.string().describe('Pack ID from list_packs or search_packs') },
  async ({ pack_id }) => {
    const pack = PACKS.find(p => p.id === pack_id);
    if (!pack) {
      return {
        content: [{ type: 'text', text: `Pack "${pack_id}" not found. Use list_packs to see available packs.` }],
        isError: true,
      };
    }
    const workflowPath = path.join(__dirname, 'workflows', pack.file);
    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          pack: { id: pack.id, name: pack.name, description: pack.description, price: pack.price, url: pack.url },
          workflow,
          setup_instructions: `1. Copy the workflow JSON below\n2. In n8n, go to Workflows > Import from JSON\n3. Paste the JSON and click Import\n4. Configure your credentials (email, Slack, Google Sheets etc.)\n5. Activate the workflow\n\nFull pack (${pack.name}) with all workflows at ${pack.url}`,
        }, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
