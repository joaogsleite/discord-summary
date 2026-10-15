# discord-summary

Read-only Discord guild reader for agent summaries. Node 24 ESM, `dotenv` + native `fetch` only. `GET` only — no send/edit/delete code exists.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env`:
   - `DISCORD_TOKEN` — user token, via Network tab:
     1. Open `discord.com/app` in browser, log in.
     2. DevTools > Network > filter `api`, refresh page.
     3. Click any request to `discord.com/api/...` > Headers > Request Headers > `authorization: <value>`.
     4. Fallback: Console on `discord.com/app`: `JSON.parse(localStorage.getItem('token'))`.
   - `GUILD_ID` — Settings > Advanced > Developer Mode ON, then right-click server > Copy Server ID.

> User tokens violate Discord ToS and risk account locks. Private low-volume use only. Never commit `.env`; if exposed, change your Discord password to invalidate it.

## Use

```bash
node src/index.js guild
node src/index.js channels [--text-only]
node src/index.js messages <channel-name-or-id> [--limit 25] [--before <id>] [--after <id>]
node src/index.js thread <thread-id> [--limit 25] [--before <id>] [--after <id>]
node src/index.js search <query> [--channel <name-or-id>] [--user <name-or-id>] [--limit 25]
```

JSON to stdout, errors to stderr. See `.agents/skills/discord-reader/SKILL.md` for the agent recipe.
