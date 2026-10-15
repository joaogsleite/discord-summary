---
name: discord-reader
description: Read-only Discord guild reader for summaries. Use when the user wants to list channels, read recent messages, search history, or summarize a Discord server pinned in .env.
---

# Discord Reader (read-only, user token)

Backend: `src/index.js` (Node 24 ESM, `dotenv` + native `fetch` only).
Only `GET https://discord.com/api/v10/*` calls. No send/edit/delete code exists.

## Setup (do once per machine)

1. `npm install`
2. `.env` (see `.env.example`):
   - `DISCORD_TOKEN=` — user token, via Network tab (most reliable):
     1. Open `discord.com/app` in browser, log in.
     2. DevTools > Network > filter `api`, refresh page.
     3. Click any request to `discord.com/api/...` > Headers > Request Headers > `authorization: <value>` — that's the token, paste as-is (no `Bot` prefix, no quotes).
     4. Fallback: Console while on `discord.com/app`: `JSON.parse(localStorage.getItem('token'))`. Must select origin `https://discord.com` under Application > Local Storage if browsing manually.
   - `GUILD_ID=` — Discord Settings > Advanced > Developer Mode ON, then right-click server > Copy Server ID.

> Note: user (self) tokens violate Discord ToS and can trigger account locks. Private, low-volume summarizer use only. Treat the token like a password: never commit `.env`, never paste it in chat. If exposed, change your Discord password to invalidate it.

## Commands (JSON to stdout, errors to stderr)

All output is `JSON.stringify(data, null, 2)` to stdout. Exit non-zero on error.

```bash
node src/index.js guild
node src/index.js channels [--text-only]
node src/index.js messages <channel-name-or-id> [--limit 25] [--before <msgId>] [--after <msgId>]
node src/index.js thread <thread-id> [--limit 25] [--before <msgId>] [--after <msgId>]
node src/index.js search <query> [--channel <name-or-id>] [--user <name-or-id>] [--limit 25]
```

- `limit`: 1–100, default 25.
- `channel` accepts name (`general`, `#general`) or id. Names must be unique or use id.
- Pagination: newest-first. Take last `id` of a batch as next `--before` to page back; `--after` to page forward.
- `search` is client-side filter over recent history (500 msgs max single channel, 50/forum fan-out). Case-insensitive substring on `content`, optional `user` filter.
- Message shape: `{ id, channel_id, author: { id, username, bot }, content, timestamp, attachments: [{filename, url}], reply_to, thread_id }` plus `channel_name` on search hits.

## Agent recipe (summarize a channel)

1. `node src/index.js channels --text-only` → pick target ids.
2. `node src/index.js messages <id> --limit 100` → if more needed, repeat with `--before <oldest-id>`.
3. Summarize locally; use `search <keyword> --channel <id>` to pull specifics.
4. Never print `DISCORD_TOKEN`. Never write to Discord (no such command exists).
