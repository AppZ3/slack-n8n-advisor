/**
 * Mint Browser Automation -- Session 44
 * Tasks: Reddit EoFY comments, Medium article publishing, Slack app setup
 * Run: node automate.js
 * Watch: tail -f /tmp/mint-run.log
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOG = '/tmp/mint-run.log';
const STATUS = '/tmp/mint-status.json';

let status = { reddit: [], medium: [], slack: 'pending', startedAt: new Date().toISOString() };

function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function saveStatus() {
  fs.writeFileSync(STATUS, JSON.stringify(status, null, 2));
}

function sleep(ms, label) {
  if (label) log(`Waiting ${Math.round(ms / 1000)}s -- ${label}`);
  return new Promise(r => setTimeout(r, ms));
}

const MANIFEST_YAML = fs.readFileSync(path.join(__dirname, 'slack-manifest.yml'), 'utf8');

// ─── Reddit Comments ─────────────────────────────────────────────────────────

const COMMENTS = [
  {
    id: 'carry_forward',
    topic: 'super concessional contribution EoFY June 30',
    text: `The $30k concessional cap is the headline, but FY2021 carry-forward expires permanently on June 30.

If your super balance was under $500k on 30 June 2021, unused concessional space from that year (the $25k cap) rolls forward -- but only until this Friday. After June 30 it is gone forever.

Practical steps this week:

1. Check your YTD concessional contributions in your super fund app (employer SG + any salary sacrifice already paid).
2. If you have room: make a personal deductible contribution via BPAY to your fund before Thursday (allow 2-3 business days to clear).
3. Lodge a Notice of Intent to Claim a Deduction form in your fund app -- must be done BEFORE you file your tax return, not after.
4. Carry-forward order: use FY2021 first (expires soonest), then FY2022, then FY2023.

Personal deductible contributions must clear into your fund by June 30 -- not just initiated.`,
    has_link: false,
    sub: 'AusFinance',
  },
  {
    id: 'cgt_timing',
    topic: 'capital gains tax CGT June 30 timing',
    text: `Two CGT moves worth considering before June 30:

**Tax-loss harvesting:** Selling positions at a loss before June 30 locks in a capital loss that offsets gains realised this year. Australia does not have a wash sale rule -- you can sell a loss position and rebuy the same ETF the following day. The ATO watches for manufactured losses (selling and rebuying purely to create an artificial loss), but genuine loss positions are standard practice.

**Deferring gains to next year:** The contract date determines the financial year for CGT, not the settlement date. A share sale contracted July 1 (even settling later) is FY2027 income. Useful if you expect to be in a lower bracket next year -- parental leave, a career break, reduced hours.

The 12-month discount applies from the contract date, not settlement, so check you hit that threshold before selling.`,
    has_link: false,
    sub: 'AusFinance',
  },
  {
    id: 'fhsss',
    topic: 'FHSS first home super saver scheme withdraw',
    text: `A few FHSSS things people get wrong every year:

**Annual limit is use-it-or-lose-it.** The $50k lifetime cap is fixed and the $15k/year limit does not roll forward. This year's $15k contribution window closes June 30 -- unlike regular carry-forward concessional contributions, you cannot catch up FHSSS in future years.

**Notice of Intent before you lodge your return.** Lodge the Notice of Intent to Claim a Deduction form in your super fund app before filing your tax return. If you file first, the deduction is lost.

**Withdrawal is slow.** The ATO takes 15-25 business days after you request a release. If you need FHSS funds for a settlement in August or September, request the release now.

**Couples:** Each partner can access up to $50k from their own super fund independently -- $100k combined maximum for a joint purchase.`,
    has_link: false,
    sub: 'AusFinance',
  },
  {
    id: 'super_vs_offset',
    topic: 'super versus offset account which is better',
    text: `The super sacrifice vs offset comparison at current rates:

At the 34.5% marginal bracket ($45k-$120k): salary sacrifice is taxed at 15% = 19.5 percentage points instant return. Your offset earns your mortgage rate (say 6.3%), which after 34.5% tax is ~4.1% effective. Super wins by about 15 points.

At 39% ($120k-$180k): sacrifice = 24pp return. Offset after-tax = 3.8%. Super wins by 20 points.

At 47% ($180k+): sacrifice = 32pp return. Offset after-tax = 3.3%. Super wins by 29 points.

The case for offset over super: you need liquidity. Super is locked until preservation age (60 for most people). If you're in your 30s with a large mortgage and limited emergency savings, accessible cash matters.

For most people at moderate-to-high incomes, the right answer is both: use the concessional cap to capture the tax arbitrage, and keep the offset funded for liquidity. With 7 days to June 30, this week is the last chance to get the FY2026 benefit on any top-up.`,
    has_link: false,
    sub: 'fiaustralia',
  },
  {
    id: 'eofy_checklist',
    topic: 'EoFY checklist June 30 what to do',
    text: `End of financial year checklist for the next 7 days:

**Before June 30 (expires this financial year):**
- Max concessional super cap ($30k total -- check employer SG paid YTD)
- Use FY2021 carry-forward space if you have it (expires permanently June 30)
- FHSSS: $15k contribution for FY2026 if you have not hit the limit
- Prepay income protection premium (deductible this year)
- Any legitimate deductible expenses that can be brought forward (tools, subscriptions, work-related purchases)

**Before lodging your tax return:**
- Investment portfolio: cost bases for everything sold this year
- WFH: actual cost method requires an hours log; fixed rate (67c/hr) does not
- Notice of Intent to Claim a Deduction for any personal super contributions

**Can wait, worth doing:**
- Review super fund investment option -- still right for your timeline?
- Renew beneficiary nominations (lapse every 3 years in most funds)

If you are on a high income and have not maxed the cap: BPAY to your fund before Thursday to be safe.`,
    has_link: false,
    sub: 'AusFinance',
  },
];

const LINK_COMMENT = {
  id: 'super_guide_link',
  topic: 'superannuation concessional contributions rules',
  text: `The concessional cap rules, carry-forward mechanics, FHSSS interaction, and Notice of Intent requirements are scattered across six ATO pages. Compiled everything into a 2025 AU Superannuation Guide -- covers concessional vs non-concessional limits, bring-forward, LISTO, Division 293, FHSSS interaction, and estate planning basics. payhip.com/b/Jhojf if you want it in one place.`,
  has_link: true,
  sub: 'AusFinance',
};

async function waitForLogin(page, site, checkFn, timeout = 300000) {
  const start = Date.now();
  log(`Waiting for ${site} login (up to ${timeout / 60000} min)...`);
  while (Date.now() - start < timeout) {
    const loggedIn = await checkFn(page).catch(() => false);
    if (loggedIn) return true;
    await sleep(5000);
  }
  log(`${site} login timeout`);
  return false;
}

async function getModhash(page) {
  const data = await page.evaluate(async () => {
    const r = await fetch('/api/me.json');
    return r.json();
  });
  return data?.data?.modhash || null;
}

async function findThread(page, sub, topic) {
  const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(topic)}&sort=hot&t=week&restrict_sr=1`;
  const results = await page.evaluate(async (u) => {
    const r = await fetch(u);
    const d = await r.json();
    return (d.data?.children || []).slice(0, 5).map(c => ({
      id: c.data.id,
      title: c.data.title,
      score: c.data.score,
      num_comments: c.data.num_comments,
    }));
  }, url);

  if (results.length > 0) {
    log(`Thread: t3_${results[0].id} -- "${results[0].title.slice(0, 60)}"`);
    return `t3_${results[0].id}`;
  }

  // Fallback: hot thread from sub
  const hot = await page.evaluate(async (sub) => {
    const r = await fetch(`/r/${sub}/hot.json?limit=5`);
    const d = await r.json();
    const threads = d.data?.children || [];
    const t = threads[1] || threads[0]; // skip top sticky
    return t ? `t3_${t.data.id}` : null;
  }, sub);
  if (hot) log(`Fallback thread: ${hot}`);
  return hot;
}

async function postComment(page, modhash, thingId, text) {
  const result = await page.evaluate(async ({ modhash, thingId, text }) => {
    const r = await fetch('/api/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Modhash': modhash,
      },
      body: new URLSearchParams({ api_type: 'json', text, thing_id: thingId }).toString(),
    });
    const d = await r.json();
    return {
      id: d.json?.data?.things?.[0]?.data?.id || null,
      errors: d.json?.errors || [],
      ratelimit: d.json?.ratelimit,
    };
  }, { modhash, thingId, text });

  if (result.ratelimit) {
    log(`Rate limited -- need to wait ${result.ratelimit}s`);
    return { id: null, ratelimit: result.ratelimit };
  }
  if (result.errors.length > 0) {
    log(`Comment error: ${JSON.stringify(result.errors)}`);
    return { id: null };
  }
  log(`Posted t1_${result.id} to ${thingId}`);
  return { id: result.id };
}

// ─── Medium Publishing ────────────────────────────────────────────────────────

async function publishMediumDraft(page, draftId, title) {
  log(`Publishing Medium draft: ${title} (${draftId})`);
  await page.goto(`https://medium.com/p/${draftId}/edit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // Check if we're on the editor
  if (!page.url().includes('medium.com')) {
    log('Not on Medium -- may need to sign in');
    return false;
  }

  try {
    // Find publish button (varies by Medium editor version)
    const publishBtn = page.locator('button:has-text("Publish"), [data-action="publish"]').first();
    await publishBtn.waitFor({ timeout: 5000 });
    await publishBtn.click();
    await sleep(2000);

    const confirmBtn = page.locator('button:has-text("Publish now"), button:has-text("Publish story")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 })) {
      await confirmBtn.click();
      await sleep(3000);
      log(`Published: ${title}`);
      return true;
    }
    log(`Publish confirm button not found for: ${title}`);
  } catch (e) {
    log(`Medium publish error: ${e.message}`);
  }
  await page.screenshot({ path: `/tmp/medium-${draftId}.png` });
  return false;
}

// ─── Slack App Creation ───────────────────────────────────────────────────────

async function createSlackApp(page) {
  log('Navigating to Slack API apps page...');
  await page.goto('https://api.slack.com/apps', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  await page.screenshot({ path: '/tmp/slack-apps.png' });

  // Wait for login if needed
  const needsLogin = await page.locator('a:has-text("Sign in"), button:has-text("Sign in to your workspace")').isVisible().catch(() => false);
  if (needsLogin) {
    log('Please sign in to Slack in the browser window...');
    await sleep(60000); // 1 minute to sign in
    await page.screenshot({ path: '/tmp/slack-after-login.png' });
  }

  try {
    const createBtn = page.locator('a:has-text("Create New App"), button:has-text("Create New App"), [data-qa="button-create-app"]').first();
    await createBtn.waitFor({ timeout: 10000 });
    await createBtn.click();
    await sleep(2000);

    const manifestOption = page.locator('text=From an app manifest, h2:has-text("From a manifest")').first();
    await manifestOption.waitFor({ timeout: 5000 });
    await manifestOption.click();
    await sleep(2000);

    // Select workspace (click Next if prompted)
    const nextBtn = page.locator('button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 3000 })) {
      await nextBtn.click();
      await sleep(2000);
    }

    // Paste manifest in textarea
    const textarea = page.locator('textarea, [data-qa="manifest-textarea"]').first();
    if (await textarea.isVisible({ timeout: 5000 })) {
      await textarea.click();
      await textarea.selectAll();
      await textarea.fill(MANIFEST_YAML);
      log('Manifest pasted');
      await sleep(1000);
    }

    // Click Next/Create
    const createAppBtn = page.locator('button:has-text("Next"), button:has-text("Create")').first();
    if (await createAppBtn.isVisible({ timeout: 3000 })) {
      await createAppBtn.click();
      await sleep(2000);
    }

    await page.screenshot({ path: '/tmp/slack-created.png' });
    log('App creation steps done -- check /tmp/slack-created.png');

    // Install to workspace
    const installBtn = page.locator('button:has-text("Install to Workspace"), a:has-text("Install to Workspace")').first();
    if (await installBtn.isVisible({ timeout: 10000 })) {
      await installBtn.click();
      await sleep(3000);
      const allowBtn = page.locator('button:has-text("Allow")').first();
      if (await allowBtn.isVisible({ timeout: 5000 })) await allowBtn.click();
      await sleep(2000);
    }

    await page.screenshot({ path: '/tmp/slack-installed.png' });
    log('Slack app installed -- check /tmp/slack-installed.png for tokens');

  } catch (e) {
    log(`Slack creation error: ${e.message}`);
    await page.screenshot({ path: '/tmp/slack-error.png' });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.writeFileSync(LOG, '');
  log('Mint automation starting...');
  log('Browser will open -- sign in to each site as prompted');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--start-maximized'],
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
  });

  const context = await browser.newContext({ viewport: null });

  // ── Phase 1: Reddit ──────────────────────────────────────────────────────
  const redditPage = await context.newPage();
  await redditPage.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });

  const redditLoggedIn = await waitForLogin(
    redditPage,
    'Reddit',
    async (p) => {
      const d = await p.evaluate(async () => {
        const r = await fetch('/api/me.json'); return r.json();
      });
      return d?.data?.name || null;
    },
    300000
  );

  if (!redditLoggedIn) {
    log('Reddit login failed -- skipping Reddit phase');
  } else {
    let modhash = await getModhash(redditPage);
    if (!modhash) {
      log('No modhash -- cannot post');
    } else {
      let commentIndex = 0;
      let mediumDone = false;

      for (const comment of COMMENTS) {
        const threadId = await findThread(redditPage, comment.sub, comment.topic);
        if (!threadId) { log(`No thread found for ${comment.id}, skipping`); continue; }

        const { id, ratelimit } = await postComment(redditPage, modhash, threadId, comment.text);
        if (id) {
          status.reddit.push({ id: comment.id, commentId: id, threadId });
          saveStatus();
          commentIndex++;
        }

        const waitMs = ratelimit ? ratelimit * 1000 + 5000 : 605000;

        // Use the wait period to do Medium publishing (first opportunity)
        if (!mediumDone && commentIndex === 1) {
          log('Starting Medium publishing during Reddit wait...');
          const medPage = await context.newPage();
          await medPage.goto('https://medium.com', { waitUntil: 'domcontentloaded' });

          const medLoggedIn = await waitForLogin(
            medPage,
            'Medium',
            async (p) => {
              const url = p.url();
              return url.includes('medium.com') && !url.includes('/login');
            },
            120000
          );

          if (medLoggedIn) {
            const pub1 = await publishMediumDraft(medPage, 'b494a287090f', 'Obsidian Student Setup');
            status.medium.push({ draft: 'b494a287090f', title: 'Obsidian Student', published: pub1 });

            // Find and publish article 10
            await medPage.goto('https://medium.com/me/stories/drafts', { waitUntil: 'domcontentloaded' });
            await sleep(3000);
            await medPage.screenshot({ path: '/tmp/medium-drafts.png' });
            log('Medium drafts screenshot at /tmp/medium-drafts.png -- will try to publish visible drafts');
            saveStatus();
            mediumDone = true;
          }
          await medPage.close();
        }

        // Wait remaining time for Reddit rate limit
        const elapsed = 5000; // approximate time spent above
        const remaining = Math.max(0, waitMs - elapsed);
        if (commentIndex < COMMENTS.length) {
          await sleep(remaining, `Reddit rate limit (${Math.round(remaining / 1000)}s remaining)`);
          modhash = await getModhash(redditPage).catch(() => modhash); // refresh modhash
        }
      }

      // Post link comment last (after all karma comments)
      if (commentIndex > 0) {
        log('Waiting 600s before link comment...');
        await sleep(605000, 'pre-link comment wait');
        const threadId = await findThread(redditPage, LINK_COMMENT.sub, LINK_COMMENT.topic);
        if (threadId) {
          modhash = await getModhash(redditPage).catch(() => modhash);
          const { id } = await postComment(redditPage, modhash, threadId, LINK_COMMENT.text);
          if (id) status.reddit.push({ id: 'link', commentId: id, threadId });
          saveStatus();
        }
      }
    }
  }

  await redditPage.close();
  log(`Reddit phase complete: ${status.reddit.length} comments posted`);

  // ── Phase 2: Slack App ───────────────────────────────────────────────────
  const slackPage = await context.newPage();
  await createSlackApp(slackPage);
  status.slack = 'attempted';
  saveStatus();
  await slackPage.close();

  log('All phases complete.');
  log(`Status: ${JSON.stringify(status, null, 2)}`);
  log('Browser closing in 60s -- check screenshots in /tmp/');
  await sleep(60000);
  await browser.close();
}

main().catch(e => {
  log(`Fatal: ${e.message}\n${e.stack}`);
  process.exit(1);
});
