# Setup Guide (Zac's actions)

## Step 1: Create Slack App (5 min)

1. Go to https://api.slack.com/apps
2. Click "Create New App" > "From an app manifest"
3. Select your workspace
4. Paste contents of `slack-manifest.yml`
5. Click "Create"
6. On the app page:
   - **Settings > Socket Mode** -- enable it, generate App-Level Token (scope: `connections:write`), copy as `SLACK_APP_TOKEN`
   - **OAuth & Permissions** -- install to workspace, copy Bot Token as `SLACK_BOT_TOKEN`
   - **Basic Information** -- copy Signing Secret as `SLACK_SIGNING_SECRET`

## Step 2: Get Anthropic API Key

Already have one from the XPRIZE work. Use same key: set as `ANTHROPIC_API_KEY`

## Step 3: Create .env file

```bash
cd ventures/slack-agent-builder
cp .env.example .env
# Edit .env with the values from Step 1-2
```

## Step 4: Run

```bash
npm start
```

You should see: `n8n Workflow Advisor is running`

## Step 5: Test in Slack

In any channel where the bot is added:
- `@n8n Advisor I need a restaurant booking automation`
- `/n8nflow customer onboarding`
- DM the bot: `what can you automate for a law firm?`

## Step 6: GitHub repo (for DevPost submission)

1. Create repo `slack-n8n-advisor` in AppZ3 GitHub account
2. Push: `git init && git add . && git commit -m "n8n Workflow Advisor for Slack Agent Builder Hackathon" && git remote add origin https://github.com/AppZ3/slack-n8n-advisor && git push -u origin main`
3. Make repo public

## Step 7: DevPost submission

1. Go to https://slackhack.devpost.com/
2. Submit project -- use content from `devpost-submission.md`
3. Track: **New Slack Agent (Track 1)**
4. Add repo URL and demo video when ready
5. Grant sandbox access to: `slackhack@salesforce.com` and `testing@devpost.com`

## Demo video script (3 min)

1. Open Slack (0:00-0:15): Show the n8n Advisor bot in a workspace
2. Slash command (0:15-0:45): Type `/n8nflow restaurant booking automation` -- show response with JSON
3. Mention (0:45-1:15): `@n8n Advisor I need to automate client onboarding for my agency` -- show matched pack
4. DM (1:15-1:45): DM the bot `what can you automate for a gym?` -- show gym workflow
5. MCP server (1:45-2:30): Show `node mcp-server.js` in terminal, then connect via a Claude Desktop config and call `list_packs` + `get_workflow("freelancer")`
6. Import to n8n (2:30-3:00): Show the JSON being pasted into n8n's import dialog and the workflow appearing
