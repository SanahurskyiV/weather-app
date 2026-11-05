---
status: Living
updated_at: "2026-11-05"
---

# Domain Context — weather-bot

<!--
CONTEXT.md is the domain glossary — not a spec and not a scratch pad. NO implementation
detail here (no datastore/broker/framework names, no API contracts) — only domain words
and the boundaries between them. Implementation choices live in the SAD and ADRs; behaviour
lives in spec.md.
-->

## Glossary

- Bot user — a person who talks to the bot on Telegram, in a private chat or a group; only in their private chat, which identifies them, can they have a Home city. NOT Operator (the Operator runs the deployment, not a conversation).
- Current weather — the conditions at the Home city at the moment of asking, as reported by the weather source. NOT a forecast or an alert (both are about the future).
- Home city — the one place a Bot user has chosen, kept with its full resolved name, coordinates and timezone; choosing again replaces it. NOT the city query (the raw text the Bot user typed).
- Operator — the owner who deploys and maintains the live bot and reads its logs; has no special in-bot powers in v1. NOT Bot user.
