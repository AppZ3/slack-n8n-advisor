/**
 * Mint Browser Session -- connects to existing Chrome at localhost:9222
 * Run: node run-session.js
 * Watch: tail -f /tmp/mint-run.log
 */

const { chromium } = require('playwright');
const fs = require('fs');

const LOG = '/tmp/mint-run.log';
const STATUS_FILE = '/tmp/mint-status.json';

const status = { reddit: [], medium: [], slack: 'pending', startedAt: new Date().toISOString() };

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function saveStatus() {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Reddit comments ──────────────────────────────────────────────────────────

const COMMENTS = [
  {
    id: 'carry_forward',
    sub: 'AusFinance',
    topic: 'super concessional June 30',
    text: `The $30k concessional cap is the headline, but FY2021 carry-forward expires permanently on June 30.

If your super balance was under $500k on 30 June 2021, unused concessional space from that year rolls forward -- but only until this Friday. After June 30 it is gone permanently.

Steps this week:

1. Check YTD concessional contributions in your super fund app (employer SG + salary sacrifice already paid).
2. If room remains: make a personal deductible contribution via BPAY before Thursday (allow 2-3 business days to clear).
3. Lodge a Notice of Intent to Claim a Deduction form in your fund app before filing your return.
4. Use FY2021 carry-forward first (expires soonest), then FY2022, then FY2023.

Contributions must clear into the fund by June 30 -- not just initiated.`,
  },
  {
    id: 'cgt_timing',
    sub: 'AusFinance',
    topic: 'capital gains tax June 30 timing',
    text: `Two CGT moves worth considering before June 30:

**Tax-loss harvesting:** Selling positions at a loss locks in a capital loss that offsets gains you realised this year. Australia does not have a wash sale rule -- you can sell a loss position and rebuy the same ETF the following day. Genuine loss positions are standard practice; the ATO targets purely manufactured losses with immediate buybacks.

**Deferring gains to FY2027:** The contract date determines the tax year, not settlement. A share sale contracted July 1 (settling later) is next year's income. Useful if you expect to be in a lower bracket in FY2027 -- parental leave, career break, reduced hours.

The 12-month CGT discount applies from the contract date, so confirm you hit that threshold before selling.`,
  },
  {
    id: 'fhsss',
    sub: 'AusFinance',
    topic: 'FHSS first home super saver June 30',
    text: `A few FHSSS things people get wrong every year:

**Annual limit is use-it-or-lose-it.** The $50k lifetime cap is fixed and the $15k/year contribution window does not roll forward the way regular carry-forward concessional caps do. This year's $15k window closes June 30.

**Notice of Intent before lodging your return.** Lodge the form in your super fund app first, then file your tax return. Filing first means the deduction is lost.

**Withdrawal is slow.** The ATO takes 15-25 business days after a release request. If you need FHSS funds for a settlement in August or September, request the release now.

**Couples:** Each partner can access up to $50k from their own super -- $100k combined maximum for a joint purchase.`,
  },
  {
    id: 'super_offset',
    sub: 'fiaustralia',
    topic: 'super salary sacrifice vs offset which better',
    text: `The super vs offset comparison at current mortgage rates:

At the 34.5% marginal bracket ($45k-$120k): salary sacrifice is taxed at 15% = 19.5 percentage point instant return. Offset earns 6.3% mortgage rate, after 34.5% tax = ~4.1% effective. Super wins by ~15 points.

At 39% ($120k-$180k): sacrifice = 24pp return. Offset after-tax = 3.8%. Super wins by ~20 points.

At 47% ($180k+): sacrifice = 32pp return. Offset after-tax = ~3.3%. Super wins by ~29 points.

The case for offset: you need liquidity. Super is locked until preservation age (60 for most). If you have a large mortgage and limited emergency savings, accessible cash matters. The practical answer for most people at moderate-to-high incomes is both: max the concessional cap for the tax arbitrage, keep offset funded for liquidity.`,
  },
  {
    id: 'checklist',
    sub: 'AusFinance',
    topic: 'EoFY end of financial year checklist June 30',
    text: `End of financial year checklist for the next 7 days:

**Before June 30:**
- Concessional super cap: $30k minus employer SG paid YTD
- FY2021 carry-forward: expires permanently June 30
- FHSSS: $15k contribution for FY2026 if not yet at limit
- Prepay income protection premium (deductible this year)
- Bring forward deductible work expenses that can be legitimately incurred now

**Before lodging your return:**
- Cost bases for all investments sold this year
- WFH: hours log for actual cost method; fixed rate (67c/hr) needs no log
- Notice of Intent to Claim Deduction for personal super contributions

**Can wait, worth doing soon:**
- Review super fund investment option
- Renew beneficiary nominations (lapse every 3 years in most funds)

If on a high income and haven't maxed the cap: BPAY to your fund before Thursday to be safe.`,
  },
  {
    id: 'link_comment',
    sub: 'AusFinance',
    topic: 'superannuation guide Australia 2025',
    text: `The concessional cap rules, carry-forward mechanics, FHSSS interaction, and Notice of Intent requirements are scattered across six ATO pages. Compiled everything into a 2025 AU Superannuation Guide -- covers concessional vs non-concessional limits, bring-forward, LISTO, Division 293, FHSSS, and estate planning basics. payhip.com/b/Jhojf if useful.`,
    is_link: true,
  },
];

async function waitForRedditLogin(page) {
  log('Checking Reddit login status...');
  for (let i = 0; i < 60; i++) {
    try {
      const name = await page.evaluate(async () => {
        const r = await fetch('/api/me.json');
        const d = await r.json();
        return d?.data?.name || null;
      });
      if (name) { log(`Logged in as u/${name}`); return name; }
    } catch {}
    if (i === 0) log('Please sign in to Reddit in the browser...');
    await sleep(5000);
  }
  return null;
}

async function getModhash(page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/me.json');
    const d = await r.json();
    return d?.data?.modhash || null;
  });
}

async function findThread(page, sub, topic) {
  try {
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(topic)}&sort=hot&t=week&restrict_sr=1`;
    const results = await page.evaluate(async (u) => {
      const r = await fetch(u);
      const d = await r.json();
      return (d.data?.children || []).slice(0, 3).map(c => ({
        id: c.data.id, title: c.data.title, score: c.data.score,
      }));
    }, url);
    if (results[0]) {
      log(`  Thread: t3_${results[0].id} -- "${results[0].title.slice(0, 55)}"`);
      return `t3_${results[0].id}`;
    }
  } catch {}
  // Fallback: second-hottest in sub
  try {
    const hot = await page.evaluate(async (sub) => {
      const r = await fetch(`/r/${sub}/hot.json?limit=6`);
      const d = await r.json();
      const t = (d.data?.children || [])[2]; // skip top 2 stickies
      return t ? `t3_${t.data.id}` : null;
    }, sub);
    if (hot) { log(`  Fallback thread: ${hot}`); return hot; }
  } catch {}
  return null;
}

async function postComment(page, modhash, thingId, text) {
  const result = await page.evaluate(async ({ modhash, thingId, text }) => {
    const r = await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Modhash': modhash },
      body: new URLSearchParams({ api_type: 'json', text, thing_id: thingId }).toString(),
    });
    const d = await r.json();
    return {
      id: d.json?.data?.things?.[0]?.data?.id || null,
      errors: d.json?.errors || [],
      ratelimit: d.json?.ratelimit,
    };
  }, { modhash, thingId, text });

  if (result.ratelimit) { log(`  Rate limited: ${result.ratelimit}s`); return result; }
  if (result.errors.length) { log(`  Error: ${JSON.stringify(result.errors)}`); return result; }
  log(`  Posted: t1_${result.id} to ${thingId}`);
  return result;
}

// ─── Medium publishing ────────────────────────────────────────────────────────

const MEDIUM_DRAFTS = [
  { id: 'b494a287090f', title: 'Obsidian Student Setup' },
];

async function publishMediumDraft(page, draft) {
  log(`Publishing Medium draft: ${draft.title}`);
  try {
    await page.goto(`https://medium.com/p/${draft.id}/edit`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);

    if (!page.url().includes('medium.com')) { log('Not on Medium'); return false; }

    const btn = page.locator('button:has-text("Publish"), [data-action="publish"]').first();
    await btn.waitFor({ timeout: 6000 });
    await btn.click();
    await sleep(2000);

    const confirm = page.locator('button:has-text("Publish now"), button:has-text("Publish story")').first();
    if (await confirm.isVisible({ timeout: 3000 })) {
      await confirm.click();
      await sleep(3000);
      log(`Published: ${draft.title}`);
      return true;
    }
    await page.screenshot({ path: `/tmp/medium-${draft.id}.png` });
    log(`Publish confirm not found -- screenshot at /tmp/medium-${draft.id}.png`);
  } catch (e) {
    log(`Medium error: ${e.message}`);
    await page.screenshot({ path: `/tmp/medium-error.png` }).catch(() => {});
  }
  return false;
}

// ─── Slack app creation ───────────────────────────────────────────────────────

const MANIFEST_YAML = fs.readFileSync(
  require('path').join(__dirname, 'slack-manifest.yml'), 'utf8'
);

async function createSlackApp(page) {
  log('Opening Slack app creation...');
  await page.goto('https://api.slack.com/apps', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  await page.screenshot({ path: '/tmp/slack-apps.png' });

  // Check if needs login
  const url = page.url();
  if (url.includes('signin') || url.includes('login')) {
    log('Please sign in to Slack in the browser...');
    for (let i = 0; i < 24; i++) {
      await sleep(5000);
      if (page.url().includes('api.slack.com/apps')) break;
    }
  }

  try {
    // Create New App button
    const createBtn = page.locator('a:has-text("Create New App"), button:has-text("Create New App")').first();
    await createBtn.waitFor({ timeout: 15000 });
    await createBtn.click();
    await sleep(2000);
    log('Clicked Create New App');

    // From a manifest
    const manifestOpt = page.locator('div:has-text("From an app manifest"):visible, h2:has-text("From a manifest"):visible').first();
    if (await manifestOpt.isVisible({ timeout: 4000 })) {
      await manifestOpt.click();
      await sleep(1500);
      log('Selected: From an app manifest');
    }

    // Next if workspace selector
    let nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 3000 })) { await nextBtn.click(); await sleep(1500); }

    // Paste manifest in textarea
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5000 })) {
      await textarea.click({ clickCount: 3 });
      await textarea.fill(MANIFEST_YAML);
      log('Manifest pasted');
      await sleep(1000);
    }

    nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 3000 })) { await nextBtn.click(); await sleep(1500); }

    const createAppBtn = page.locator('button:has-text("Create"), button:has-text("Create App")').first();
    if (await createAppBtn.isVisible({ timeout: 5000 })) { await createAppBtn.click(); await sleep(3000); }

    await page.screenshot({ path: '/tmp/slack-created.png' });
    log('App created -- screenshot at /tmp/slack-created.png');

    // Install to workspace
    const installBtn = page.locator('a:has-text("Install to Workspace"), button:has-text("Install to Workspace")').first();
    if (await installBtn.isVisible({ timeout: 10000 })) {
      await installBtn.click();
      await sleep(3000);
      const allowBtn = page.locator('button:has-text("Allow")').first();
      if (await allowBtn.isVisible({ timeout: 5000 })) { await allowBtn.click(); await sleep(3000); }
    }

    // Extract tokens from page
    await page.goto('https://api.slack.com/apps', { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    // Navigate to the new app
    const appLink = page.locator('a:has-text("n8n Workflow Advisor")').first();
    if (await appLink.isVisible({ timeout: 5000 })) {
      await appLink.click();
      await sleep(2000);
      await page.screenshot({ path: '/tmp/slack-app-page.png' });
      log('App page screenshot at /tmp/slack-app-page.png');
    }

    status.slack = 'created';
    saveStatus();
    log('Slack app creation complete');
  } catch (e) {
    log(`Slack error: ${e.message}`);
    await page.screenshot({ path: '/tmp/slack-error.png' }).catch(() => {});
    status.slack = 'error';
    saveStatus();
  }
}

// ─── DevPost submission ───────────────────────────────────────────────────────

const DEVPOST_SUBMISSION = {
  name: 'n8n Workflow Advisor',
  tagline: 'Get a ready-to-import n8n automation workflow in Slack -- just describe what you need.',
  track: 'New Slack Agent',
  repoUrl: 'https://github.com/AppZ3/slack-n8n-advisor',
  description: `n8n Workflow Advisor is a Slack agent that turns plain-English requests into ready-to-import n8n workflow JSON files. Your team types what they need to automate; the agent returns the right workflow template with step-by-step setup instructions.

Example interactions:
- @n8n-advisor I need to automate invoice reminders for overdue clients -> returns Freelancer Automation workflow JSON
- /n8nflow customer onboarding email sequence -> returns Customer Onboarding pack sample
- @n8n-advisor restaurant reservation confirmations -> returns Restaurant + Hospitality workflow

Covers 33 business verticals: agencies, bookkeeping, dental clinics, e-commerce, healthcare, HR, IT service desks, legal, real estate, restaurants, SaaS, and more.

Architecture:
- Slack Bolt JS (socket mode) handles /n8nflow command, @mentions, and DMs
- MCP server exposes workflow catalog as list_packs / search_packs / get_workflow tools
- Claude Haiku matches user intent to the right automation pack
- 33 workflow JSON files (one per industry vertical) ready to import into n8n

Built with: Node.js, @slack/bolt, @anthropic-ai/sdk, @modelcontextprotocol/sdk`,
};

async function submitDevPost(ctx) {
  log('=== PHASE 0: DevPost submission (slackhack.devpost.com) ===');
  const page = await ctx.newPage();
  try {
    await page.goto('https://slackhack.devpost.com/submissions/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: '/tmp/devpost-start.png' });
    log('DevPost screenshot: /tmp/devpost-start.png');

    // Check if logged in
    const url = page.url();
    if (url.includes('login') || url.includes('sign_in') || url.includes('join')) {
      log('Please sign in to DevPost (AppZ3 account) in the browser tab...');
      for (let i = 0; i < 24; i++) {
        await sleep(5000);
        if (!page.url().includes('login') && !page.url().includes('sign_in')) break;
      }
      await sleep(2000);
    }

    // If redirected to submissions/new, fill it in
    if (page.url().includes('submissions') || page.url().includes('devpost.com')) {
      await page.screenshot({ path: '/tmp/devpost-form.png' });
      log('DevPost form screenshot: /tmp/devpost-form.png');

      // Fill project name
      const nameField = page.locator('input[name="submission[name]"], input#submission_name, input[placeholder*="project name" i]').first();
      if (await nameField.isVisible({ timeout: 5000 })) {
        await nameField.fill(DEVPOST_SUBMISSION.name);
        log('Filled project name');
      }

      // Fill tagline
      const tagField = page.locator('input[name="submission[tagline]"], input#submission_tagline, input[placeholder*="tagline" i]').first();
      if (await tagField.isVisible({ timeout: 3000 })) {
        await tagField.fill(DEVPOST_SUBMISSION.tagline);
        log('Filled tagline');
      }

      // Fill description
      const descField = page.locator('textarea[name="submission[description]"], textarea#submission_description').first();
      if (await descField.isVisible({ timeout: 3000 })) {
        await descField.fill(DEVPOST_SUBMISSION.description);
        log('Filled description');
      }

      // Add GitHub repo
      const repoField = page.locator('input[placeholder*="github" i], input[name*="repo" i], input[name*="url" i]').first();
      if (await repoField.isVisible({ timeout: 3000 })) {
        await repoField.fill(DEVPOST_SUBMISSION.repoUrl);
        log('Filled GitHub URL');
      }

      await page.screenshot({ path: '/tmp/devpost-filled.png' });
      log('DevPost form filled -- screenshot: /tmp/devpost-filled.png');

      // Save as draft (don't submit yet -- need video)
      const draftBtn = page.locator('button:has-text("Save"), button:has-text("Save Draft"), input[value*="Save" i]').first();
      if (await draftBtn.isVisible({ timeout: 3000 })) {
        await draftBtn.click();
        await sleep(3000);
        log('Saved DevPost draft');
        await page.screenshot({ path: '/tmp/devpost-saved.png' });
      }
    }

    status.devpost = page.url();
    saveStatus();
    log(`DevPost submission URL: ${page.url()}`);
  } catch (e) {
    log(`DevPost error: ${e.message}`);
    await page.screenshot({ path: '/tmp/devpost-error.png' }).catch(() => {});
  }
  await page.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.writeFileSync(LOG, '');
  log('Connecting to Chrome at localhost:9222...');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const [ctx] = browser.contexts();
  const pages = ctx.pages();
  const redditPage = pages[0] || await ctx.newPage();

  // DevPost submission -- open in background tab while Reddit login is pending
  submitDevPost(ctx).catch(e => log(`DevPost bg error: ${e.message}`));

  // Ensure Reddit page is navigated
  if (!redditPage.url().includes('reddit.com')) {
    await redditPage.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });
  }

  // Phase 1: Reddit
  log('=== PHASE 1: Reddit EoFY Comments ===');
  const username = await waitForRedditLogin(redditPage);

  if (username) {
    let modhash = await getModhash(redditPage);
    let posted = 0;
    let mediumDone = false;

    for (let i = 0; i < COMMENTS.length; i++) {
      const c = COMMENTS[i];
      if (c.is_link && posted < 3) { log(`Skipping link comment until 3+ karma posts done`); continue; }

      log(`\n--- Comment ${i + 1}/${COMMENTS.length}: ${c.id} ---`);
      const threadId = await findThread(redditPage, c.sub, c.topic);
      if (!threadId) { log('No thread found, skipping'); continue; }

      const result = await postComment(redditPage, modhash, threadId, c.text);
      if (result.id) {
        posted++;
        status.reddit.push({ id: c.id, commentId: result.id, threadId });
        saveStatus();
      }

      // Use wait period for Medium publishing (during first wait)
      if (i < COMMENTS.length - 1) {
        const waitSec = result.ratelimit || 605;
        log(`Waiting ${waitSec}s before next comment...`);

        // Do Medium during first 600s window
        if (!mediumDone && posted === 1) {
          const medPage = await ctx.newPage();
          await medPage.goto('https://medium.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
          log('Medium tab opened -- please sign in with getactcomply@gmail.com if needed');
          await sleep(15000); // time to sign in

          for (const draft of MEDIUM_DRAFTS) {
            const ok = await publishMediumDraft(medPage, draft);
            status.medium.push({ id: draft.id, title: draft.title, published: ok });
            saveStatus();
          }

          // Screenshot drafts page for manual publishing of article 10
          await medPage.goto('https://medium.com/me/stories/drafts', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await sleep(3000);
          await medPage.screenshot({ path: '/tmp/medium-drafts.png' });
          log('Drafts list screenshot at /tmp/medium-drafts.png');
          await medPage.close();
          mediumDone = true;
        }

        // Wait remaining time
        const elapsed = mediumDone && posted === 1 ? 30 : 0;
        const remaining = Math.max(10, waitSec - elapsed);
        await sleep(remaining * 1000);
        modhash = await getModhash(redditPage).catch(() => modhash);
      }
    }

    log(`\nReddit done: ${posted} comments posted`);
  } else {
    log('Reddit login failed -- skipping');
  }

  // Phase 2: Slack app
  log('\n=== PHASE 2: Slack App Creation ===');
  const slackPage = await ctx.newPage();
  await createSlackApp(slackPage);
  await slackPage.close();

  log('\nAll done. Check /tmp/mint-status.json for summary.');
  log('Chrome stays open for you to use.');
  saveStatus();
}

main().catch(e => {
  log(`Fatal: ${e.message}`);
  process.exit(1);
});
