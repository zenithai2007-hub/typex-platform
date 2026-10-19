# TYPE X Core — Phase 1

The real foundation of **TYPE X**: a universal AI execution platform
(AI agent + platform keyboard + platform connection).

This monorepo holds the working core: typed domain models, the AI gateway,
the platform registry, the agent state machine, the permission policy engine,
scoped memory, the execution engine, the database layer, and the first two
platform adapters (WhatsApp via respond.io, generic web). **No voice /
microphone anywhere.** Nothing here fakes a connection, a message, or a
success — every adapter returns `ok: false` with an honest code when it
cannot do the thing.

```
┌────────────────────────────── TYPE X CORE ──────────────────────────────┐
│                                                                          │
│   ┌──────────────┐        ┌──────────────────┐        ┌───────────────┐   │
│   │  AI GATEWAY  │        │   AGENT ENGINE   │        │  CONNECTION   │   │
│   │  @typex/ai   │───────▶│  @typex/agents   │◀──────▶│   ENGINE      │   │
│   │ Local/       │ plan   │ Orchestrator     │ ctx    │ @typex/       │   │
│   │ OpenAI/      │        │ EVENT→AUDIT      │        │ platforms +   │   │
│   │ Anthropic    │        │ pipeline         │        │ adapters      │   │
│   └──────────────┘        └────────┬─────────┘        └───────────────┘   │
│         ▲                          │                      ▲              │
│         │              ┌───────────┴───────────┐           │              │
│         │              │    POLICY ENGINE      │           │              │
│         │              │  @typex/permissions   │           │              │
│         │              │  explicit grants,     │           │              │
│         │              │  auditable denials    │           │              │
│         │              └───────────┬───────────┘           │              │
│         │                          ▼                       │              │
│   ┌──────────────┐        ┌──────────────────┐   ┌────────┴────────┐     │
│   │ SCOPED MEMORY│        │ EXECUTION ENGINE │   │  @typex/db      │     │
│   │ @typex/memory│        │ @typex/execution │   │  Store / Prisma │     │
│   └──────────────┘        └────────┬─────────┘   └─────────────────┘     │
│                                    │                                     │
│              ┌─────────────────────┼──────────────────────┐              │
│              ▼                     ▼                      ▼              │
│        mode: 'api'           mode: 'browser'         mode: 'keyboard'    │
│   real adapter calls     Phase 2 — browser       Phase 2 — keyboard      │
│   (WhatsApp live)        extension (honest       companion (honest       │
│                          "not yet" + Assisted    "not yet" + Assisted    │
│                          Mode)                   Mode)                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | What it is |
|---|---|
| `@typex/types` | Shared domain types: `Capability`, `Platform`, `PlatformAdapter`, `Agent`, `AgentTask`, `Permission`, `Approval`, `AuditEvent`, `ActionPlan`, `ExecutionResult`, … |
| `@typex/ai` | `AIProvider` interface + `LocalProvider` (real offline engine: task detection, tones, EN/Roman Urdu/Urdu, translation dict), `OpenAIProvider`, `AnthropicProvider` (key-gated, server-only) |
| `@typex/platforms` | `PlatformRegistry` (register/unregister/list/listByCapability) + `PlatformAdapterBase` (honest `unsupported` defaults) |
| `@typex/agents` | `AgentOrchestrator` — the real event→audit pipeline |
| `@typex/permissions` | `PolicyEngine` — explicit grants, default-deny on sensitive actions, auditable denials |
| `@typex/memory` | `ScopedMemory` — `${scope}:${scopeId}:${key}` namespacing, no cross-agent leaks |
| `@typex/execution` | `ExecutionEngine` — dispatches `api`/`browser`/`keyboard` modes |
| `@typex/db` | Prisma schema (25 models) + `Store` interface + `MemoryStore` + `PrismaStore` + `getStore()` |
| `@typex/whatsapp` | Real respond.io v2 adapter (`send`, `readContext`, `connect`) |
| `@typex/generic-web` | Honest pre-extension adapter (Assisted Mode) |

## Quick start

```bash
npm install
npm run db:generate   # prisma generate — works with no live DB
npm run typecheck     # tsc --noEmit — must be clean
npm test              # vitest — must be green
```

Without `DATABASE_URL` everything runs in **DEMO MODE** (in-memory store,
warning on boot). Set `DATABASE_URL` to switch to Postgres — no code changes.

```ts
import { AgentOrchestrator } from '@typex/agents';
import { LocalProvider } from '@typex/ai';
import { PlatformRegistry } from '@typex/platforms';
import { PolicyEngine } from '@typex/permissions';
import { ScopedMemory } from '@typex/memory';
import { ExecutionEngine } from '@typex/execution';
import { getStore } from '@typex/db';
import { WhatsAppAdapter, whatsappPlatform } from '@typex/whatsapp';
import { Permission } from '@typex/types';

const registry = new PlatformRegistry();
registry.register(whatsappPlatform, new WhatsAppAdapter());

const orch = new AgentOrchestrator({
  store: getStore(),          // PrismaStore if DATABASE_URL set, else MemoryStore
  ai: new LocalProvider(),    // or new OpenAIProvider() / new AnthropicProvider()
  registry,
  permissions: new PolicyEngine(),
  memory: new ScopedMemory(),
  execution: new ExecutionEngine(),
});

const agent = await orch.createAgent({
  userId: 'user_1',
  platformId: 'whatsapp',
  name: 'Sales Agent',
  instructions: 'You are a concise sales assistant.',
  permissions: [Permission.READ_CONTEXT, Permission.GENERATE_CONTENT, Permission.SEND_MESSAGE],
});

// Event → context → memory → plan → permission gate → approval → execute → audit
const res = await orch.handleEvent({
  type: 'message',
  agentId: agent.id,
  payload: { text: 'reply to the customer about pricing', to: '923001234567' },
});
// res = { ok: true, approvalRequired: true, approvalId, data: { preview } }

await orch.approveAction(res.approvalId, 'approved'); // executes via the real adapter
```

## The orchestrator pipeline

1. **Load agent** → 404 if unknown.
2. **Status check** — only `READY`/`ACTIVE` process events; agent → `ACTIVE`.
3. **Adapter** from the registry — missing adapter fails honestly.
4. **Context** — `getCurrentContext()` / `readContext()` (best-effort; never blocks planning).
5. **Scoped memory** — `AGENT` scope (+ `CONVERSATION` when present); namespaced per agent.
6. **Plan** — `ai.planAction(instruction, context)` → `ActionDraft { kind, payload, mode, requiresApproval, permission, preview }`.
7. **Permission gate** — `PolicyEngine.checkPermissions`; denial → `DENIED` audit, no execution.
8. **ActionPlan** built (id, kind, platformId, payload, mode).
9. **Task** → `RUNNING` (transitions enforced: `CREATED→RUNNING→…→COMPLETED/FAILED`).
10. **Approval gate** — if `requiresApproval` and no pre-approval: `Approval(PENDING)`, agent → `WAITING_APPROVAL`, audit `PREPARED`, return `{ approvalRequired: true }`.
11. **Execute** — `ExecutionEngine.execute(plan, adapter)` → audit `EXECUTED`/`FAILED`, agent → `READY`, task → `COMPLETED`/`FAILED`.

`approveAction(id, 'approved'|'rejected'|'cancelled')` resumes the pipeline from
the stored plan. **Every stage writes an `AuditEvent`.**

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | no | Postgres connection (Neon). Unset → DEMO MODE (in-memory). |
| `RESPONDIO_API_KEY` | for WhatsApp sends | respond.io API key. Read lazily per call; server-side only. |
| `RESPONDIO_WHATSAPP_CHANNEL_ID` | no | WhatsApp channel id (else inferred). |
| `OPENAI_API_KEY` | for OpenAI provider | Server-side only — never expose client-side. |
| `ANTHROPIC_API_KEY` | for Anthropic provider | Server-side only — never expose client-side. |
| `TYPEX_AI_FAST` | no | `1` skips LocalProvider's simulated thinking delays (tests/scripts). |

See `.env.example`.

## Neon 2-minute setup

1. Create a free project at [neon.tech](https://neon.tech) → copy the connection string.
2. `DATABASE_URL="postgresql://…"` in `.env` (Vercel → Project Settings → Environment Variables for deploys).
3. `npx prisma migrate deploy --schema packages/db/prisma/schema.prisma` (or `prisma db push` for a first prototype).
4. Done — `getStore()` now returns `PrismaStore`. No code changes anywhere.

## DEMO MODE

No `DATABASE_URL` → `getStore()` returns `MemoryStore` and prints:

> `TYPE X DEMO MODE — no DATABASE_URL; using local in-memory store. Data will not persist.`

Everything works (agents, approvals, audit, memory) but state lives in the
process. The UI must label this honestly — never present demo state as production.

## Phase 2 roadmap

- **Browser extension** — real page-context read + in-tab execution (`browser` mode stops answering `phase2`).
- **Keyboard companion** — `keyboard` mode types approved text anywhere.
- **Desktop app** — control center outside the browser.
- **Realtime WS** — push events instead of polling (agent loop, live chats).
- **OAuth** — first-class platform connections (Google, Meta, …).

## Honest limits (read before promising anything)

- **WhatsApp**: respond.io API v2 shapes were ported from public integration
  guides (2026-10-19) **without a live key**. Contact-search params,
  conversation filter params, and inbound-message field names are
  **unverified** — the adapter lists + matches locally and normalizes
  defensively so it works regardless, but the first live test must log one raw
  API response and tighten the mapping. `ok: true` is only ever returned when
  respond.io confirms.
- **Generic web**: no DOM access until the Phase-2 extension — Assisted Mode
  (copy the prepared output) by design.
- **Local AI**: template-based generation (real, offline, multilingual) — not
  a neural model. The translator is a small honest dictionary, labeled as v1.
- **Cloud AI**: needs paid keys the user provides; providers throw
  `ConfigurationError` without one. Keys are server-only.
- **Approvals**: outbound `send_message` plans require approval (or an explicit
  `SEND_MESSAGE` grant + pre-approval) — by design, not a bug.

## Monorepo notes

- npm workspaces: `apps/*`, `packages/*`, `platforms/*`. No per-package build
  step — the web app consumes sources via Next.js `transpilePackages`
  (`@typex/*`) + root `tsconfig.json` path aliases.
- `npm run build` = `prisma generate` + `tsc --noEmit` (the `apps/web` Next.js
  app lands separately; `vercel.json` already points at it).
- Deploy target: Vercel, Next.js, `outputDirectory: apps/web/.next`.
