# @typex/whatsapp

Real respond.io API v2 adapter for the WhatsApp platform.

## Env

- `RESPONDIO_API_KEY` — required, read lazily per operation (never at import).
- `RESPONDIO_WHATSAPP_CHANNEL_ID` — optional.

## Behavior

- `connect()` — verifies the key against the API.
- `send({ to, text, name? })` — creates (or resolves on duplicate) the contact,
  then POSTs `/v2/messages`. `ok: true` **only** when respond.io confirms.
- `readContext({ phone | contactId, since?, limit? })` — newest open
  conversation's messages, normalized defensively.
- `insertText()` — assisted-only (copy into the client).

## ⚠️ Unverified field names — verify on first live test

Shapes were ported from the public respond.io v2 integration guides
(2026-10-19) without a live key. Still unverified:

1. Exact query params for server-side contact search by phone — we **list +
   match locally** by digits, which works regardless.
2. Conversation list filter params — we try `?contactId=` then fall back to
   the full list + local match.
3. Exact inbound-message field names — `normMessage()` checks every plausible
   shape (`message.text`, `text`, `body`, `direction`, `fromContact`, …).

During the first live test, log one raw `/conversations/{id}/messages`
response and tighten `normMessage()` + `asList()` to the confirmed shape.
