/**
 * DevPost submission for Slack Agent Builder Hackathon
 * Connects to existing Chrome at localhost:9222
 * Run: node submit-devpost.js
 */

const { chromium } = require('playwright');
const fs = require('fs');

const LOG = '/tmp/devpost-submit.log';
function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SUBMISSION = {
  name: 'n8n Workflow Advisor',
  tagline: 'Get a ready-to-import n8n automation workflow in Slack -- just describe what you need.',
  builtWith: 'node.js, slack-bolt, anthropic-sdk, modelcontextprotocol, n8n',
  description: `n8n Workflow Advisor is a Slack agent that turns plain-English requests into ready-to-import n8n workflow JSON files. Your team types what they need to automate; the agent returns the right workflow template with step-by-step setup instructions.

**How it works:**
1. User types: "@n8n Advisor I need a workflow for client onboarding"
2. Claude Haiku matches the request to the best industry pack
3. Agent returns workflow JSON ready to import + setup guide + full pack link

**MCP server:** The agent includes a standalone MCP server exposing 33 workflow packs as tools: list_packs, search_packs(query), get_workflow(pack_id). Works with any MCP-compatible client.

**33 industry verticals covered:** Agency, bookkeeping, dental, e-commerce, healthcare, HR, IT service desk, legal, logistics, marketing, nonprofit, photography, project management, property management, real estate, recruitment, restaurant, SaaS, sales/CRM, social media, subscription, supply chain, veterinary, YouTube, and more.

**Architecture:**
- Slack Bolt JS (socket mode) -- /n8nflow slash command + @mentions + DMs
- @modelcontextprotocol/sdk -- MCP server with list_packs / search_packs / get_workflow tools
- @anthropic-ai/sdk (Claude Haiku) -- intent matching, fast and cost-efficient
- 33 n8n workflow JSON files -- one per industry vertical, ready to import`,
  repoUrl: 'https://github.com/AppZ3/slack-n8n-advisor',
};

async function main() {
  fs.writeFileSync(LOG, '');
  log('Connecting to Chrome...');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const [ctx] = browser.contexts();
  const page = await ctx.newPage();

  // Go to DevPost login
  log('Opening DevPost login...');
  await page.goto('https://devpost.com/login?return_to=https%3A%2F%2Fslackhack.devpost.com%2Fsubmissions%2Fnew', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await sleep(2000);
  await page.screenshot({ path: '/tmp/dp1-login.png' });
  log('Login page open -- sign in as AppZ3 (use GitHub OAuth)');

  // Wait for login completion (URL changes from login page)
  log('Waiting for login...');
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/register') && !url.includes('sign_in')) {
      log(`Logged in. URL: ${url}`);
      break;
    }
    if (i % 6 === 5) log(`Still waiting for login... (${(i + 1) * 5}s)`);
  }

  await page.screenshot({ path: '/tmp/dp2-after-login.png' });
  log('Screenshot: /tmp/dp2-after-login.png');

  // Navigate to submission form
  const url = page.url();
  if (!url.includes('slackhack.devpost.com') && !url.includes('submissions')) {
    log('Navigating to hackathon submissions page...');
    await page.goto('https://slackhack.devpost.com/submissions/new', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);
  }

  await page.screenshot({ path: '/tmp/dp3-submissions.png' });
  log(`Submission page. URL: ${page.url()}`);

  // Fill submission form
  try {
    // Project name
    const nameField = page.locator('input[name="submission[name]"], input#submission_name, input[placeholder*="name" i]').first();
    if (await nameField.isVisible({ timeout: 5000 })) {
      await nameField.clear();
      await nameField.fill(SUBMISSION.name);
      log('Filled: project name');
    }

    // Tagline
    const taglineField = page.locator('input[name="submission[tagline]"], input#submission_tagline, input[placeholder*="tagline" i]').first();
    if (await taglineField.isVisible({ timeout: 3000 })) {
      await taglineField.clear();
      await taglineField.fill(SUBMISSION.tagline);
      log('Filled: tagline');
    }

    // GitHub repo URL -- look for "Add a link" type fields
    const repoInput = page.locator('input[placeholder*="github" i], input[placeholder*="repository" i], input[name*="repo" i]').first();
    if (await repoInput.isVisible({ timeout: 3000 })) {
      await repoInput.fill(SUBMISSION.repoUrl);
      log('Filled: GitHub URL');
    }

    // Built with
    const builtWithInput = page.locator('input[placeholder*="built with" i], input[name*="tech" i], .built-with-input').first();
    if (await builtWithInput.isVisible({ timeout: 3000 })) {
      await builtWithInput.fill(SUBMISSION.builtWith);
      log('Filled: built with');
    }

    await page.screenshot({ path: '/tmp/dp4-filled.png' });
    log('Form filled screenshot: /tmp/dp4-filled.png');

    // Save as draft
    const saveBtn = page.locator('button:has-text("Save"), input[value*="Save" i], a:has-text("Save draft")').first();
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click();
      await sleep(3000);
      await page.screenshot({ path: '/tmp/dp5-saved.png' });
      log(`Saved. URL: ${page.url()}`);
    } else {
      log('Save button not found -- screenshot for manual review');
      await page.screenshot({ path: '/tmp/dp4b-nosave.png' });
    }
  } catch (e) {
    log(`Form fill error: ${e.message}`);
    await page.screenshot({ path: '/tmp/dp-error.png' }).catch(() => {});
  }

  log(`Final URL: ${page.url()}`);
  log('Done -- DevPost tab stays open for your review');
  // Keep tab open (don't close) so Zac can review and submit
  await browser.close();
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
