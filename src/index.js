#!/usr/bin/env node
// Read-only Discord guild reader (user token, raw REST).
// Only performs GET requests. No send/delete/update calls exist in this file.
import "dotenv/config";

const API = "https://discord.com/api/v10";

function env(name) {
  return process.env[name]?.trim();
}

function requireEnv() {
  constfailIf(!env("DISCORD_TOKEN"), "Missing DISCORD_TOKEN in .env (your user token from browser localStorage).");
  constfailIf(!env("GUILD_ID"), "Missing GUILD_ID in .env (right-click server > Copy Server ID).");
  return { token: env("DISCORD_TOKEN"), guildId: env("GUILD_ID") };
}

function constfailIf(cond, msg) {
  if (cond) {
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
}

// --- REST (GET only) ---
async function api(path, query = {}) {
  const { token } = requireEnv();
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const wait = Math.ceil((body.retry_after ?? 1) * 1000);
    console.error(`Rate limited. Retrying after ${wait}ms...`);
    await new Promise((r) => setTimeout(r, wait));
    return api(path, query);
  }
  if (res.status === 401) {
    console.error("Error: 401 Unauthorized. Token invalid or expired. Grab a fresh one (see SKILL.md).");
    process.exit(1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Error: GET ${path} -> ${res.status} ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return res.json();
}

// Discord channel types: https://discord.com/developers/docs/resources/channel#channel-object-channel-types
const TEXT_TYPES = new Set([0, 5, 10, 11, 12, 15, 16]); // text, news, threads, forum, media
const TYPE_NAMES = {
  0: "text", 1: "dm", 2: "voice", 4: "category", 5: "news",
  10: "news_thread", 11: "public_thread", 12: "private_thread",
  13: "stage", 14: "directory", 15: "forum", 16: "media",
};

function shapeMessage(m) {
  return {
    id: m.id,
    channel_id: m.channel_id,
    author: m.author ? { id: m.author.id, username: m.author.username, bot: !!m.author.bot } : null,
    content: m.content ?? "",
    timestamp: m.timestamp,
    attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, url: a.url })),
    reply_to: m.referenced_message?.id ?? m.message_reference?.message_id ?? null,
    thread_id: m.thread?.id ?? null,
  };
}

async function resolveChannel(ref, guildId) {
  const channels = await api(`/guilds/${guildId}/channels`);
  const byId = channels.find((c) => c.id === ref);
  if (byId) return byId;
  const lower = ref.toLowerCase().replace(/^#/, "");
  const matches = channels.filter((c) => (c.name ?? "").toLowerCase() === lower);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error(`Error: channel name "${ref}" is ambiguous (${matches.length} matches). Use an ID.`);
    process.exit(1);
  }
  console.error(`Error: channel "${ref}" not found. Run \`channels\` to list names/ids.`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = { limit: 25 };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--limit" || a === "-n") flags.limit = clampInt(args[++i], 1, 100, "limit");
    else if (a === "--before") flags.before = args[++i];
    else if (a === "--after") flags.after = args[++i];
    else if (a === "--channel" || a === "-c") flags.channel = args[++i];
    else if (a === "--user" || a === "-u") flags.user = args[++i];
    else if (a.startsWith("--")) {
      console.error(`Error: unknown flag ${a}`);
      process.exit(1);
    } else positional.push(a);
  }
  return { flags, positional };
}

function clampInt(v, min, max, name) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.error(`Error: --${name} must be ${min}-${max}, got "${v}".`);
    process.exit(1);
  }
  return n;
}

function out(data) {
  console.log(JSON.stringify(data, null, 2));
}

function help() {
  console.log(`discord-summary (read-only, GET only)

Usage:
  node src/index.js guild
  node src/index.js channels [--text-only]
  node src/index.js messages <channel-name-or-id> [--limit 25] [--before <msgId>] [--after <msgId>]
  node src/index.js thread <thread-id> [--limit 25] [--before <msgId>] [--after <msgId>]
  node src/index.js search <query> [--channel <name-or-id>] [--user <name-or-id>] [--limit 25]

Env (.env):
  DISCORD_TOKEN=<user token>   # browser localStorage: token key (see SKILL.md)
  GUILD_ID=<server id>         # right-click server > Copy Server ID

Output: JSON array/object to stdout. Errors + rate-limit notices to stderr.
`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
  help();
  process.exit(0);
}

switch (cmd) {
  case "guild": {
    const { guildId } = requireEnv();
    out(await api(`/guilds/${guildId}?with_counts=true`));
    break;
  }
  case "channels": {
    const { guildId } = requireEnv();
    const textOnly = rest.includes("--text-only");
    const channels = await api(`/guilds/${guildId}/channels`);
    out(
      channels
        .filter((c) => (textOnly ? TEXT_TYPES.has(c.type) || c.type === 4 : true))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          type_name: TYPE_NAMES[c.type] ?? String(c.type),
          topic: c.topic ?? null,
          parent_id: c.parent_id ?? null,
          position: c.position ?? 0,
        }))
    );
    break;
  }
  case "messages": {
    const { guildId } = requireEnv();
    const { flags, positional } = parseFlags(rest);
    if (!positional[0]) {
      console.error("Error: usage: messages <channel-name-or-id> [--limit 25] [--before <id>] [--after <id>]");
      process.exit(1);
    }
    const ch = await resolveChannel(positional[0], guildId);
    const msgs = await api(`/channels/${ch.id}/messages`, {
      limit: Math.min(flags.limit, 100),
      before: flags.before,
      after: flags.after,
    });
    out(msgs.map(shapeMessage));
    break;
  }
  case "thread": {
    const { flags, positional } = parseFlags(rest);
    if (!positional[0]) {
      console.error("Error: usage: thread <thread-id> [--limit 25] [--before <id>] [--after <id>]");
      process.exit(1);
    }
    const msgs = await api(`/channels/${positional[0]}/messages`, {
      limit: Math.min(flags.limit, 100),
      before: flags.before,
      after: flags.after,
    });
    out(msgs.map(shapeMessage));
    break;
  }
  case "search": {
    const { flags, positional } = parseFlags(rest);
    const query = positional.join(" ").toLowerCase();
    if (!query) {
      console.error("Error: usage: search <query> [--channel <name-or-id>] [--user <name-or-id>] [--limit 25]");
      process.exit(1);
    }
    const userF = (flags.user ?? "").toLowerCase();
    const { guildId } = requireEnv();
    let targets;
    if (flags.channel) {
      targets = [await resolveChannel(flags.channel, guildId)];
    } else {
      const all = await api(`/guilds/${guildId}/channels`);
      targets = all.filter((c) => c.type === 0 || c.type === 5); // top-level text only for fan-out
    }
    const perChannel = flags.channel ? 100 : 50;
    const pages = flags.channel ? 5 : 1; // cap: 500 msgs single channel, 50 x N channels fan-out
    const hits = [];
    for (const ch of targets) {
      let before;
      for (let p = 0; p < pages && hits.length < flags.limit * 4; p++) {
        const batch = await api(`/channels/${ch.id}/messages`, { limit: perChannel, before });
        if (!batch.length) break;
        for (const m of batch) {
          const content = (m.content ?? "").toLowerCase();
          const author = m.author?.username?.toLowerCase() ?? "";
          if (content.includes(query) && (!userF || author.includes(userF) || m.author?.id === flags.user)) {
            hits.push({ ...shapeMessage(m), channel_name: ch.name });
            if (hits.length >= flags.limit) break;
          }
        }
        if (hits.length >= flags.limit) break;
        before = batch[batch.length - 1].id;
        if (batch.length < perChannel) break;
      }
      if (hits.length >= flags.limit) break;
    }
    out(hits.slice(0, flags.limit));
    break;
  }
  default:
    console.error(`Error: unknown command "${cmd}".`);
    help();
    process.exit(1);
}
