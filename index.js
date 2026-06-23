require('dotenv').config();
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { PACKS } = require('./catalog.js');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildCatalogContext() {
  return PACKS.map(p =>
    `- ${p.id}: ${p.name} | Industries: ${p.industries.join(', ')} | ${p.description}`
  ).join('\n');
}

function getWorkflow(packId) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return null;
  const workflowPath = path.join(__dirname, 'workflows', pack.file);
  return { pack, workflow: JSON.parse(fs.readFileSync(workflowPath, 'utf8')) };
}

async function matchPackWithClaude(userRequest) {
  const catalog = buildCatalogContext();
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are an n8n workflow advisor. Given a user request, identify the single best matching automation pack from the catalog.

CATALOG:
${catalog}

USER REQUEST: "${userRequest}"

Respond with ONLY a JSON object: {"pack_id": "<id>", "confidence": "high|medium|low", "reason": "<one sentence>"}
If no pack fits, respond: {"pack_id": null, "confidence": "none", "reason": "<explanation>"}`,
    }],
  });

  try {
    const text = message.content[0].text.trim();
    return JSON.parse(text);
  } catch {
    return { pack_id: null, confidence: 'none', reason: 'Could not parse response' };
  }
}

function formatWorkflowResponse(pack, workflow, reason) {
  const workflowJson = JSON.stringify(workflow, null, 2);
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${pack.name}* (${pack.price})\n${pack.description}\n\n_${reason}_`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Setup:*\n1. Copy the JSON below\n2. In n8n: Workflows > Import from JSON\n3. Configure your credentials\n4. Activate\n\n*Full pack (all workflows):* <${pack.url}|Get ${pack.name}>`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Sample workflow JSON:*\n\`\`\`\n${workflowJson.slice(0, 2800)}\n\`\`\``,
      },
    },
  ];
}

async function handleWorkflowRequest(text, respond, say) {
  const match = await matchPackWithClaude(text);

  if (!match.pack_id) {
    await respond({
      text: `I could not find a matching n8n automation pack for that request.\n\nAvailable industries: ${PACKS.map(p => p.industries[0]).join(', ')}\n\nTry: "I need a workflow for [your industry]"`,
    });
    return;
  }

  const result = getWorkflow(match.pack_id);
  if (!result) {
    await respond({ text: 'Error loading workflow. Please try again.' });
    return;
  }

  const { pack, workflow } = result;
  const blocks = formatWorkflowResponse(pack, workflow, match.reason);

  await respond({
    text: `Found: ${pack.name}`,
    blocks,
    unfurl_links: false,
  });
}

// Handle @mentions
app.event('app_mention', async ({ event, say }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (!text) {
    await say(`Hi! Ask me for an n8n automation workflow. Example: "I need a workflow for client onboarding" or "build me a restaurant booking automation"`);
    return;
  }
  await handleWorkflowRequest(text, ({ text: t, blocks, unfurl_links }) => say({ text: t, blocks, unfurl_links }), say);
});

// Handle /n8nflow slash command
app.command('/n8nflow', async ({ command, ack, respond }) => {
  await ack();
  const text = command.text.trim();
  if (!text) {
    await respond('Usage: `/n8nflow I need a workflow for [your industry/use case]`');
    return;
  }
  await handleWorkflowRequest(text, respond, respond);
});

// Handle DMs
app.message(async ({ message, say }) => {
  if (message.subtype || !message.text) return;
  await handleWorkflowRequest(message.text, ({ text: t, blocks, unfurl_links }) => say({ text: t, blocks, unfurl_links }), say);
});

// App Home tab
app.event('app_home_opened', async ({ event, client }) => {
  const topPacks = PACKS.slice(0, 8);
  await client.views.publish({
    user_id: event.user,
    view: {
      type: 'home',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: 'n8n Workflow Advisor', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Get a ready-to-import n8n workflow for any business need.*\n\nJust describe what you want to automate and I\'ll return the right workflow JSON with setup instructions.',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*How to use:*' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '• Mention me in any channel: `@n8n Advisor I need a booking workflow for my restaurant`\n• Use the slash command: `/n8nflow customer onboarding automation`\n• Send me a direct message with your automation need',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*33 industry packs available:*\n${topPacks.map(p => `• ${p.name}`).join('\n')}\n_...and ${PACKS.length - topPacks.length} more_` },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: 'Powered by Claude AI + MCP | Built for Slack Agent Builder Hackathon 2026' }],
        },
      ],
    },
  });
});

(async () => {
  await app.start();
  console.log('n8n Workflow Advisor is running');
})();
