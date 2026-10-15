# Glossary

## Guild

A Discord "server". Pinned per install via `GUILD_ID`. All commands are scoped to one Guild.

## GuildChannel

A channel inside a Guild. v1 cares about text-capable types (`text`, `news`, `forum`, `media`, thread types). Referenced by ID (stable) or name (must be unique).

## Message

An immutable post in a GuildChannel or Thread. Read as `{ id, author, content, timestamp, attachments }`. Paginated newest-first via `before` / `after` message IDs.

## Search (client-side)

Substring filter over recently fetched Messages, not Discord's server-side search index. Bounded (≤500 messages per call) to stay small and ToS-light.

## User Token

Full-account credential grabbed from browser localStorage. Grants the script everything your account can see. Against Discord ToS for automation; used here only for private read-only summaries. Distinct from a Bot Token (scoped, ToS-compliant, needs a Discord Application).
